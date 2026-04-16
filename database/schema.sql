-- Vivan Phase 1 schema (MySQL 8+)
-- Set DB_NAME in backend .env (default: vivan)

CREATE DATABASE IF NOT EXISTS vivan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vivan;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20) NULL,
  gst_number VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_blocked TINYINT(1) NOT NULL DEFAULT 0,
  accepted_terms TINYINT(1) NOT NULL DEFAULT 0,
  kyc_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ---------------------------------------------------------------------------
-- Refresh tokens (hashed at rest)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_hash (token_hash),
  INDEX idx_refresh_expires (expires_at)
);

-- ---------------------------------------------------------------------------
-- Categories (parent_id = subcategory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT NULL,
  image_url VARCHAR(512) NULL,
  meta_title VARCHAR(160) NULL,
  meta_description VARCHAR(320) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id),
  INDEX idx_categories_active (is_active)
);

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  logo_url VARCHAR(512) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NULL,
  brand_id BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  sku VARCHAR(100) NULL UNIQUE,
  short_description VARCHAR(255) NULL,
  long_description TEXT NULL,
  mrp_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  bv DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Business volume',
  pv DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Point value',
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 COMMENT 'GST %',
  stock_qty INT NOT NULL DEFAULT 0,
  image_url VARCHAR(512) NULL,
  gallery_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_new_arrival TINYINT(1) NOT NULL DEFAULT 0,
  is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_brand (brand_id),
  INDEX idx_products_active (is_active),
  INDEX idx_products_sale_price (sale_price),
  INDEX idx_products_bv (bv),
  INDEX idx_products_slug_active (slug, is_active),
  INDEX idx_products_deleted (deleted_at)
);

-- ---------------------------------------------------------------------------
-- Banners
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Payments (Razorpay, etc.)
-- ---------------------------------------------------------------------------
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
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_provider_order (provider, provider_order_id),
  INDEX idx_payments_status (status)
);

-- ---------------------------------------------------------------------------
-- Product reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(200) NULL,
  body TEXT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_review_user_product (user_id, product_id),
  INDEX idx_reviews_product (product_id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_user_product (user_id, product_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Wallets (store credit ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  held_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  checkout_intent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
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
    'bonus_credit',
    'withdrawal_hold',
    'withdrawal_paid',
    'withdrawal_reversed',
    'withdrawal_cancelled'
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
  updated_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_withdrawal_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
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
  INDEX idx_bank_user (user_id),
  CONSTRAINT fk_bank_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
  INDEX idx_wd_status (status),
  CONSTRAINT fk_wd_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wd_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wd_processed_by FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_number VARCHAR(40) NULL UNIQUE,
  invoice_url VARCHAR(512) NULL,
  status ENUM('pending','paid','packed','shipped','delivered','cancelled','returned') NOT NULL DEFAULT 'pending',
  payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  wallet_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  customer_gstin VARCHAR(20) NULL,
  shipping_name VARCHAR(120) NOT NULL,
  shipping_phone VARCHAR(20) NOT NULL,
  shipping_address1 VARCHAR(255) NOT NULL,
  shipping_address2 VARCHAR(255) NULL,
  shipping_city VARCHAR(100) NOT NULL,
  shipping_state VARCHAR(100) NOT NULL,
  shipping_pincode VARCHAR(20) NOT NULL,
  commission_processed_at DATETIME NULL,
  commission_status VARCHAR(40) NULL,
  commission_audit_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_number (order_number),
  INDEX idx_orders_status (status),
  INDEX idx_orders_invoice (invoice_number)
);

CREATE TABLE IF NOT EXISTS serviceable_pincodes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pincode VARCHAR(12) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  shipping_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  cod_available TINYINT(1) NOT NULL DEFAULT 1,
  estimated_days INT NOT NULL DEFAULT 3,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_serviceable_pincode (pincode),
  INDEX idx_pincode_active (pincode, is_active)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(180) NOT NULL,
  product_slug VARCHAR(200) NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 1,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
);

-- ---------------------------------------------------------------------------
-- Referral + binary commissions (Phase 7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_users (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  referral_code VARCHAR(20) NOT NULL,
  sponsor_user_id BIGINT UNSIGNED NULL,
  level INT NOT NULL DEFAULT 1,
  placement_parent_user_id BIGINT UNSIGNED NULL,
  placement_side ENUM('left', 'right') NULL,
  welcome_bonus_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_referral_users_code (referral_code),
  UNIQUE KEY uq_referral_placement_leg (placement_parent_user_id, placement_side),
  INDEX idx_referral_sponsor (sponsor_user_id),
  INDEX idx_referral_placement_parent (placement_parent_user_id),
  CONSTRAINT fk_ref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ref_sponsor FOREIGN KEY (sponsor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ref_placement_parent FOREIGN KEY (placement_parent_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS referral_tree_stats (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  total_left_members INT NOT NULL DEFAULT 0,
  total_right_members INT NOT NULL DEFAULT 0,
  total_left_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_right_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referral_closure (
  ancestor_user_id BIGINT UNSIGNED NOT NULL,
  descendant_user_id BIGINT UNSIGNED NOT NULL,
  depth INT NOT NULL,
  leg_side ENUM('left', 'right') NULL,
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
  INDEX idx_binary_carry_matchable (left_profit_carry, right_profit_carry),
  CONSTRAINT fk_binary_carry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commission_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  commission_type ENUM(
    'welcome_bonus',
    'direct_referral',
    'binary_match',
    'binary_ceiling_hold',
    'manual_adjustment'
  ) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  wallet_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ceiling_blocked_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  settings_snapshot_json JSON NULL,
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
  INDEX idx_binary_payout_user (user_id),
  CONSTRAINT fk_binary_payout_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_type VARCHAR(64) NOT NULL,
  severity ENUM('info', 'warning', 'danger') NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_system_alerts_created (created_at),
  INDEX idx_system_alerts_type (alert_type)
);

-- ---------------------------------------------------------------------------
-- Compensation admin settings (Phase 8)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compensation_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  welcome_bonus_enabled TINYINT(1) NOT NULL DEFAULT 1,
  welcome_bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 250.00,
  direct_income_enabled TINYINT(1) NOT NULL DEFAULT 1,
  direct_income_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  direct_income_value DECIMAL(12,4) NOT NULL DEFAULT 30.0000,
  trigger_stage ENUM('paid', 'delivered') NOT NULL DEFAULT 'delivered',
  max_direct_income_per_order DECIMAL(12,2) NULL,
  binary_income_enabled TINYINT(1) NOT NULL DEFAULT 1,
  binary_left_percentage DECIMAL(8,4) NOT NULL DEFAULT 15.0000,
  binary_right_percentage DECIMAL(8,4) NOT NULL DEFAULT 15.0000,
  binary_percentage DECIMAL(8,4) NOT NULL DEFAULT 10.0000 COMMENT 'Single % of matched carry (binary gross before fees/caps)',
  carry_forward_enabled TINYINT(1) NOT NULL DEFAULT 1,
  daily_binary_ceiling DECIMAL(12,2) NOT NULL DEFAULT 4000.00,
  binary_ceiling_behavior ENUM('hold_unpaid', 'discard_unpaid') NOT NULL DEFAULT 'hold_unpaid',
  refund_reversal_enabled TINYINT(1) NOT NULL DEFAULT 1,
  minimum_order_profit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL,
  CONSTRAINT fk_comp_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT IGNORE INTO compensation_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS commission_manual_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  adjustment_type VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  action ENUM('credit', 'debit') NOT NULL,
  reason VARCHAR(500) NOT NULL,
  apply_to_wallet TINYINT(1) NOT NULL DEFAULT 0,
  wallet_transaction_id BIGINT UNSIGNED NULL,
  commission_transaction_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_man_user (user_id),
  INDEX idx_man_order (order_id),
  INDEX idx_man_created (created_at),
  CONSTRAINT fk_man_adj_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_man_adj_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_man_adj_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- Key/value settings (COD toggle, shipping rules)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Baseline reference data (roles + settings)
-- ---------------------------------------------------------------------------
INSERT INTO roles (slug, name) VALUES
  ('customer', 'Customer'),
  ('admin', 'Administrator')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO settings (`key`, `value`) VALUES
  ('cod_enabled', 'true'),
  ('default_shipping_fee', '49'),
  ('free_shipping_above', '999'),
  ('business_state_code', '27')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT INTO serviceable_pincodes (pincode, city, state, shipping_charge, cod_available, estimated_days, is_active) VALUES
  ('400001', 'Mumbai', 'Maharashtra', 49.00, 1, 2, 1),
  ('110001', 'New Delhi', 'Delhi', 59.00, 1, 3, 1),
  ('560001', 'Bengaluru', 'Karnataka', 55.00, 1, 3, 1),
  ('700001', 'Kolkata', 'West Bengal', 52.00, 0, 4, 1)
ON DUPLICATE KEY UPDATE city = VALUES(city), state = VALUES(state);

-- ---------------------------------------------------------------------------
-- India compliance (grievance, audit, bank payout log; app bootstraps on older DBs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open','resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_complaints_user (user_id),
  INDEX idx_complaints_status (status),
  CONSTRAINT fk_complaints_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  withdrawal_request_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  reference_id VARCHAR(100) NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'razorpay',
  error_message VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payouts_withdrawal (withdrawal_request_id),
  INDEX idx_payouts_user (user_id),
  INDEX idx_payouts_status (status),
  CONSTRAINT fk_payouts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payouts_wr FOREIGN KEY (withdrawal_request_id) REFERENCES withdrawal_requests(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Fraud (see also database/migrations/016_fraud_detection.sql; app bootstraps columns)
-- ---------------------------------------------------------------------------
-- fraud_logs: heuristic audit trail
-- users.signup_ip VARCHAR(45) NULL — set on registration for shared-IP checks
-- wallets.is_locked TINYINT(1) NOT NULL DEFAULT 0 — blocks user debits & withdrawals when set
