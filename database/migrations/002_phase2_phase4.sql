-- Phase 2 + Phase 4 migration for existing `vivan` database
-- Run once: mysql -u root -p vivan < database/migrations/002_phase2_phase4.sql
-- If `deleted_at` already exists, skip the ALTER TABLE products line.

USE vivan;

ALTER TABLE products
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
  ADD INDEX idx_products_deleted (deleted_at);

CREATE TABLE IF NOT EXISTS banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NULL,
  image_url VARCHAR(512) NOT NULL,
  link_url VARCHAR(512) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_banners_active_sort (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'razorpay',
  provider_order_id VARCHAR(120) NULL,
  provider_payment_id VARCHAR(120) NULL,
  provider_signature VARCHAR(255) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  raw_payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_provider_order (provider, provider_order_id),
  INDEX idx_payments_status (status)
);
