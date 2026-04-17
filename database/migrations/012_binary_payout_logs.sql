-- Audit + idempotency for cron binary payouts (one row per user per IST calendar day).
-- Run: mysql -u root -p vivan < database/migrations/012_binary_payout_logs.sql

USE vivan;

CREATE TABLE IF NOT EXISTS binary_payout_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  payout_date DATE NOT NULL,
  matched_bv DECIMAL(14,2) NOT NULL,
  gross_income DECIMAL(14,2) NOT NULL,
  tds_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  admin_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_wallet_amount DECIMAL(14,2) NOT NULL,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_binary (user_id, payout_date),
  INDEX idx_binary_payout_user (user_id)
);
