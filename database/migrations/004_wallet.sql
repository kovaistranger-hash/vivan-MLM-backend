-- Phase 6: user wallets, ledger, checkout integration
-- Run: mysql -u root -p vivan < database/migrations/004_wallet.sql

USE vivan;

CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  checkout_intent_amount DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Server-side wallet amount user intends at checkout (not deducted until order)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wallets_user (user_id),
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallets_active (is_active)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  wallet_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM(
    'credit',
    'debit',
    'refund',
    'admin_credit',
    'admin_debit',
    'order_payment',
    'order_refund',
    'commission_credit',
    'bonus_credit'
  ) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id BIGINT NULL,
  description VARCHAR(255) NULL,
  metadata_json JSON NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallet_tx_user (user_id),
  INDEX idx_wallet_tx_wallet (wallet_id),
  INDEX idx_wallet_tx_type (type),
  INDEX idx_wallet_tx_ref (reference_type, reference_id)
);

ALTER TABLE orders
  ADD COLUMN wallet_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_amount;
