-- Phase 7: referral tree, binary volume, commissions
-- Run: mysql -u root -p vivan < database/migrations/005_referral_binary.sql

USE vivan;

CREATE TABLE IF NOT EXISTS referral_users (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  referral_code VARCHAR(20) NOT NULL,
  sponsor_user_id BIGINT UNSIGNED NULL,
  placement_parent_user_id BIGINT UNSIGNED NULL,
  placement_side ENUM('left', 'right') NULL,
  welcome_bonus_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_referral_users_code (referral_code),
  INDEX idx_referral_sponsor (sponsor_user_id),
  INDEX idx_referral_placement_parent (placement_parent_user_id),
  CONSTRAINT fk_ref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ref_sponsor FOREIGN KEY (sponsor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ref_placement_parent FOREIGN KEY (placement_parent_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS referral_closure (
  ancestor_user_id BIGINT UNSIGNED NOT NULL,
  descendant_user_id BIGINT UNSIGNED NOT NULL,
  depth INT NOT NULL,
  leg_side ENUM('left', 'right') NULL COMMENT 'First step from ancestor binary toward descendant; NULL for self depth 0',
  PRIMARY KEY (ancestor_user_id, descendant_user_id),
  INDEX idx_closure_desc (descendant_user_id),
  CONSTRAINT fk_closure_anc FOREIGN KEY (ancestor_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_closure_desc FOREIGN KEY (descendant_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS binary_carry (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  left_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
  right_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_binary_carry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commission_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  commission_type ENUM('welcome_bonus', 'direct_referral', 'binary_match', 'binary_ceiling_hold') NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Profit basis or matched volume',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Commission amount before ceiling split',
  wallet_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Credited to wallet',
  ceiling_blocked_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comm_user (user_id),
  INDEX idx_comm_order (order_id),
  INDEX idx_comm_type (commission_type),
  CONSTRAINT fk_comm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comm_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS binary_daily_summary (
  user_id BIGINT UNSIGNED NOT NULL,
  summary_date DATE NOT NULL,
  binary_paid_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  ceiling_blocked_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, summary_date),
  CONSTRAINT fk_bin_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE orders
  ADD COLUMN profit_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal,
  ADD COLUMN commission_processed_at DATETIME NULL,
  ADD COLUMN commission_status VARCHAR(40) NULL,
  ADD COLUMN commission_audit_json JSON NULL COMMENT 'Snapshot for admin reversal + recalculate';
