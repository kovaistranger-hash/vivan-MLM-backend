-- Phase 8: admin-managed compensation + manual adjustments audit
-- Run: mysql -u root -p vivan < database/migrations/006_compensation_settings.sql

USE vivan;

CREATE TABLE IF NOT EXISTS compensation_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  welcome_bonus_enabled TINYINT(1) NOT NULL DEFAULT 1,
  welcome_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 250.00,
  direct_income_enabled TINYINT(1) NOT NULL DEFAULT 1,
  direct_income_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  direct_income_value DECIMAL(12,4) NOT NULL DEFAULT 30.0000 COMMENT 'percentage: 30 = 30%; fixed: INR per order',
  trigger_stage ENUM('paid','delivered') NOT NULL DEFAULT 'delivered',
  max_direct_income_per_order DECIMAL(12,2) NULL COMMENT 'NULL = no cap',
  binary_income_enabled TINYINT(1) NOT NULL DEFAULT 1,
  binary_left_percentage DECIMAL(8,4) NOT NULL DEFAULT 15.0000,
  binary_right_percentage DECIMAL(8,4) NOT NULL DEFAULT 15.0000,
  carry_forward_enabled TINYINT(1) NOT NULL DEFAULT 1,
  daily_binary_ceiling DECIMAL(12,2) NOT NULL DEFAULT 4000.00,
  binary_ceiling_behavior ENUM('hold_unpaid','discard_unpaid') NOT NULL DEFAULT 'hold_unpaid',
  refund_reversal_enabled TINYINT(1) NOT NULL DEFAULT 1,
  minimum_order_profit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL
);

INSERT IGNORE INTO compensation_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS commission_manual_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  adjustment_type VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  action ENUM('credit','debit') NOT NULL,
  reason VARCHAR(500) NOT NULL,
  apply_to_wallet TINYINT(1) NOT NULL DEFAULT 0,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  commission_transaction_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_man_user (user_id),
  INDEX idx_man_order (order_id),
  INDEX idx_man_created (created_at)
);

ALTER TABLE commission_transactions
  MODIFY COLUMN commission_type ENUM(
    'welcome_bonus',
    'direct_referral',
    'binary_match',
    'binary_ceiling_hold',
    'manual_adjustment'
  ) NOT NULL;

ALTER TABLE commission_transactions
  ADD COLUMN settings_snapshot_json JSON NULL COMMENT 'compensation_settings row snapshot at posting time' AFTER metadata_json;
