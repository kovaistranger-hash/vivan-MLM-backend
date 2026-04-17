-- Phase 9: wallet withdrawals, bank accounts, holds
-- Run: mysql -u root -p vivan < database/migrations/007_withdrawal.sql

USE vivan;

ALTER TABLE wallets
  ADD COLUMN held_balance DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER balance;

CREATE TABLE IF NOT EXISTS withdrawal_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  min_withdrawal_amount DECIMAL(12,2) NOT NULL DEFAULT 100.00,
  max_withdrawal_amount DECIMAL(12,2) NULL COMMENT 'NULL = no max',
  withdrawal_fee_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
  withdrawal_fee_value DECIMAL(12,4) NOT NULL DEFAULT 0,
  kyc_required TINYINT(1) NOT NULL DEFAULT 0,
  auto_approve TINYINT(1) NOT NULL DEFAULT 0,
  allow_upi TINYINT(1) NOT NULL DEFAULT 1,
  allow_bank_transfer TINYINT(1) NOT NULL DEFAULT 1,
  one_pending_request_only TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL
);

INSERT IGNORE INTO withdrawal_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  account_holder_name VARCHAR(120) NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(34) NULL,
  ifsc_code VARCHAR(11) NULL,
  branch_name VARCHAR(160) NULL,
  upi_id VARCHAR(100) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bank_user (user_id)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  bank_account_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL COMMENT 'Gross requested amount (moved to hold)',
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'approved', 'paid', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  notes VARCHAR(500) NULL,
  admin_remarks VARCHAR(500) NULL,
  processed_by BIGINT UNSIGNED NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wd_user_status (user_id, status),
  INDEX idx_wd_status (status)
);

ALTER TABLE wallet_transactions
  MODIFY COLUMN type ENUM(
    'credit',
    'debit',
    'refund',
    'admin_credit',
    'admin_debit',
    'order_payment',
    'order_refund',
    'commission_credit',
    'bonus_credit',
    'withdrawal_hold',
    'withdrawal_paid',
    'withdrawal_reversed',
    'withdrawal_cancelled'
  ) NOT NULL;
