import { query } from '../../db/mysql.js';
import type { Connection } from 'mysql2/promise';

type SqlParams = Record<string, unknown> | unknown[];

/** When set (during `initDB` bootstrap), all DDL uses this executor so FK/session flags apply on one connection. */
let schemaBootstrapSql: ((sql: string, params?: SqlParams) => Promise<unknown>) | null = null;

async function sq<T = unknown>(sql: string, params: SqlParams = [] as SqlParams): Promise<T> {
  if (schemaBootstrapSql) {
    return (await schemaBootstrapSql(sql, params)) as T;
  }
  return query<T>(sql, params);
}

let referralSchemaReady = false;
let referralSchemaPromise: Promise<void> | null = null;

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await sq<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(tableName: string, indexName: string): Promise<boolean> {
  const rows = await sq<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureRolesTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS roles (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(60) NOT NULL UNIQUE,
      name VARCHAR(80) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await sq(
    `INSERT INTO roles (slug, name) VALUES
      ('customer', 'Customer'),
      ('admin', 'Administrator')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`
  );
}

async function ensureRefreshTokensTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_refresh_user (user_id),
      INDEX idx_refresh_hash (token_hash),
      INDEX idx_refresh_expires (expires_at)
    )
  `);
}

async function ensureWalletTables() {
  await sq(`
    CREATE TABLE IF NOT EXISTS wallets (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      held_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      checkout_intent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      is_locked TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_wallets_user (user_id),
      INDEX idx_wallets_active (is_active)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      wallet_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
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
      INDEX idx_wallet_tx_user (user_id),
      INDEX idx_wallet_tx_wallet (wallet_id),
      INDEX idx_wallet_tx_type (type),
      INDEX idx_wallet_tx_ref (reference_type, reference_id)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS withdrawal_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      min_withdrawal_amount DECIMAL(12,2) NOT NULL DEFAULT 100.00,
      max_withdrawal_amount DECIMAL(12,2) NULL,
      withdrawal_fee_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
      withdrawal_fee_value DECIMAL(12,4) NOT NULL DEFAULT 0,
      kyc_required TINYINT(1) NOT NULL DEFAULT 0,
      auto_approve TINYINT(1) NOT NULL DEFAULT 0,
      allow_upi TINYINT(1) NOT NULL DEFAULT 1,
      allow_bank_transfer TINYINT(1) NOT NULL DEFAULT 1,
      one_pending_request_only TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by BIGINT UNSIGNED NULL
    )
  `);

  await sq(`INSERT IGNORE INTO withdrawal_settings (id) VALUES (1)`);
}

async function ensureCompensationSettingsTable() {
  await sq(`
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
      binary_percentage DECIMAL(8,4) NOT NULL DEFAULT 10.0000,
      carry_forward_enabled TINYINT(1) NOT NULL DEFAULT 1,
      daily_binary_ceiling DECIMAL(12,2) NOT NULL DEFAULT 4000.00,
      binary_ceiling_behavior ENUM('hold_unpaid', 'discard_unpaid') NOT NULL DEFAULT 'hold_unpaid',
      refund_reversal_enabled TINYINT(1) NOT NULL DEFAULT 1,
      minimum_order_profit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by BIGINT UNSIGNED NULL
    )
  `);

  await sq(`INSERT IGNORE INTO compensation_settings (id) VALUES (1)`);
}

/**
 * **`users` DDL** (this repo has no `src/db/init.ts`): invoked from **`db.ts`** → `createTables()` →
 * `ensureReferralSchemaExists(initConn)` → `ensureReferralSchemaTables()` first.
 * Minimal `id` only here so bootstrap never self-references `users` and FK types stay aligned (`INT UNSIGNED`).
 * Full auth columns come from `database/schema.sql` / migrations on environments that apply them.
 */
async function ensureUsersTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    )
  `);
}

async function ensureUsersCoreColumns() {
  if (!(await columnExists('users', 'role_id'))) {
    await sq(`ALTER TABLE users ADD COLUMN role_id BIGINT UNSIGNED NULL AFTER id`);
  }
  if (!(await columnExists('users', 'email'))) {
    await sq(`ALTER TABLE users ADD COLUMN email VARCHAR(190) NULL AFTER role_id`);
  }
  if (!(await columnExists('users', 'password_hash'))) {
    await sq(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email`);
  }
  if (!(await columnExists('users', 'name'))) {
    await sq(`ALTER TABLE users ADD COLUMN name VARCHAR(120) NULL AFTER password_hash`);
  }
  if (!(await columnExists('users', 'phone'))) {
    await sq(`ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL AFTER name`);
  }
  if (!(await columnExists('users', 'signup_ip'))) {
    await sq(`ALTER TABLE users ADD COLUMN signup_ip VARCHAR(45) NULL AFTER phone`);
  }
  if (!(await columnExists('users', 'is_active'))) {
    await sq(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER signup_ip`);
  }
  if (!(await columnExists('users', 'accepted_terms'))) {
    await sq(`ALTER TABLE users ADD COLUMN accepted_terms TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active`);
  }
  if (!(await columnExists('users', 'expo_token'))) {
    await sq(`ALTER TABLE users ADD COLUMN expo_token VARCHAR(255) NULL AFTER accepted_terms`);
  }
  if (!(await columnExists('users', 'created_at'))) {
    await sq(`ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER expo_token`);
  }
  if (!(await columnExists('users', 'updated_at'))) {
    await sq(
      `ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`
    );
  }

  const hasEmailUnique = await sq<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_email'`,
    []
  );
  if (Number(hasEmailUnique[0]?.total || 0) === 0) {
    try {
      await sq(`ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)`);
    } catch {
      /* Existing duplicate data can block this; auth still functions without the constraint. */
    }
  }
}

async function ensureCoreAuthSchema() {
  await ensureRolesTable();
  await ensureUsersTable();
  await ensureUsersCoreColumns();
  await ensureRefreshTokensTable();
  await ensureWalletTables();
  await ensureCompensationSettingsTable();
}

async function ensureUsersComplianceColumns() {
  if (!(await columnExists('users', 'kyc_verified'))) {
    await sq(`ALTER TABLE users ADD COLUMN kyc_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active`);
  }
  if (!(await columnExists('users', 'kyc_level'))) {
    await sq(`ALTER TABLE users ADD COLUMN kyc_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER kyc_verified`);
  }
}

async function ensureCategoriesTable() {
  await sq(`
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
      INDEX idx_categories_parent (parent_id),
      INDEX idx_categories_active (is_active)
    )
  `);
}

async function ensureBrandsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS brands (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(140) NOT NULL UNIQUE,
      logo_url VARCHAR(512) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureProductsTable() {
  await sq(`
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
      bv DECIMAL(12,2) NOT NULL DEFAULT 0,
      pv DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
      stock_qty INT NOT NULL DEFAULT 0,
      image_url VARCHAR(512) NULL,
      gallery_json JSON NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      is_new_arrival TINYINT(1) NOT NULL DEFAULT 0,
      is_bestseller TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at DATETIME NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('products', 'category_id'))) {
    await sq(`ALTER TABLE products ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER id`);
  }
  if (!(await columnExists('products', 'brand_id'))) {
    await sq(`ALTER TABLE products ADD COLUMN brand_id BIGINT UNSIGNED NULL AFTER category_id`);
  }
  if (!(await columnExists('products', 'short_description'))) {
    await sq(`ALTER TABLE products ADD COLUMN short_description VARCHAR(255) NULL AFTER sku`);
  }
  if (!(await columnExists('products', 'long_description'))) {
    await sq(`ALTER TABLE products ADD COLUMN long_description TEXT NULL AFTER short_description`);
  }
  if (!(await columnExists('products', 'mrp_price'))) {
    await sq(`ALTER TABLE products ADD COLUMN mrp_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER long_description`);
  }
  if (!(await columnExists('products', 'sale_price'))) {
    await sq(`ALTER TABLE products ADD COLUMN sale_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER mrp_price`);
  }
  if (!(await columnExists('products', 'bv'))) {
    await sq(`ALTER TABLE products ADD COLUMN bv DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sale_price`);
  }
  if (!(await columnExists('products', 'pv'))) {
    await sq(`ALTER TABLE products ADD COLUMN pv DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER bv`);
  }
  if (!(await columnExists('products', 'gst_rate'))) {
    await sq(`ALTER TABLE products ADD COLUMN gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00 AFTER pv`);
  }
  if (!(await columnExists('products', 'stock_qty'))) {
    await sq(`ALTER TABLE products ADD COLUMN stock_qty INT NOT NULL DEFAULT 0 AFTER gst_rate`);
  }
  if (!(await columnExists('products', 'gallery_json'))) {
    await sq(`ALTER TABLE products ADD COLUMN gallery_json JSON NULL AFTER image_url`);
  }
  if (!(await columnExists('products', 'is_active'))) {
    await sq(`ALTER TABLE products ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER gallery_json`);
  }
  if (!(await columnExists('products', 'is_featured'))) {
    await sq(`ALTER TABLE products ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active`);
  }
  if (!(await columnExists('products', 'is_new_arrival'))) {
    await sq(`ALTER TABLE products ADD COLUMN is_new_arrival TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured`);
  }
  if (!(await columnExists('products', 'is_bestseller'))) {
    await sq(`ALTER TABLE products ADD COLUMN is_bestseller TINYINT(1) NOT NULL DEFAULT 0 AFTER is_new_arrival`);
  }
  if (!(await columnExists('products', 'deleted_at'))) {
    await sq(`ALTER TABLE products ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER is_bestseller`);
  }
  if (!(await columnExists('products', 'created_at'))) {
    await sq(`ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER deleted_at`);
  }
  if (!(await columnExists('products', 'updated_at'))) {
    await sq(
      `ALTER TABLE products ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`
    );
  }

  if (await columnExists('products', 'price')) {
    await sq(`
      UPDATE products
      SET sale_price = CASE
            WHEN COALESCE(sale_price, 0) = 0 AND COALESCE(price, 0) > 0 THEN price
            ELSE sale_price
          END
    `);
  }

  if (await columnExists('products', 'mrp')) {
    await sq(`
      UPDATE products
      SET mrp_price = CASE
            WHEN COALESCE(mrp_price, 0) = 0 AND COALESCE(mrp, 0) > 0 THEN mrp
            ELSE mrp_price
          END
    `);
  }

  if (await columnExists('products', 'stock')) {
    await sq(`
      UPDATE products
      SET stock_qty = CASE
            WHEN COALESCE(stock_qty, 0) = 0 AND COALESCE(stock, 0) > 0 THEN stock
            ELSE stock_qty
          END
    `);
  }

  if (await columnExists('products', 'description')) {
    await sq(`
      UPDATE products
      SET long_description = CASE
            WHEN (long_description IS NULL OR long_description = '') AND description IS NOT NULL AND description <> ''
              THEN description
            ELSE long_description
          END,
          short_description = CASE
            WHEN (short_description IS NULL OR short_description = '') AND description IS NOT NULL AND description <> ''
              THEN LEFT(description, 255)
            ELSE short_description
          END
    `);
  }

  if (await columnExists('products', 'gallery_urls')) {
    await sq(`
      UPDATE products
      SET gallery_json = CASE
            WHEN gallery_json IS NULL AND gallery_urls IS NOT NULL THEN gallery_urls
            ELSE gallery_json
          END
    `);
  }

  if (await columnExists('products', 'status')) {
    await sq(`
      UPDATE products
      SET is_active = CASE
            WHEN status = 'active' THEN 1
            WHEN status IN ('draft', 'inactive') THEN 0
            ELSE is_active
          END
    `);
  }

  if (!(await indexExists('products', 'idx_products_category'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_category (category_id)`);
  }
  if (!(await indexExists('products', 'idx_products_brand'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_brand (brand_id)`);
  }
  if (!(await indexExists('products', 'idx_products_active'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_active (is_active)`);
  }
  if (!(await indexExists('products', 'idx_products_sale_price'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_sale_price (sale_price)`);
  }
  if (!(await indexExists('products', 'idx_products_bv'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_bv (bv)`);
  }
  if (!(await indexExists('products', 'idx_products_slug_active'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_slug_active (slug, is_active)`);
  }
  if (!(await indexExists('products', 'idx_products_deleted'))) {
    await sq(`ALTER TABLE products ADD INDEX idx_products_deleted (deleted_at)`);
  }
}

async function ensureBannersTable() {
  await sq(`
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
    )
  `);
}

async function ensurePaymentsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
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
    )
  `);
}

async function ensureProductReviewsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      product_id BIGINT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      rating TINYINT UNSIGNED NOT NULL,
      title VARCHAR(200) NULL,
      body TEXT NULL,
      is_approved TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_review_user_product (user_id, product_id),
      INDEX idx_reviews_product (product_id)
    )
  `);
}

async function ensureCartItemsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cart_user_product (user_id, product_id)
    )
  `);
}

async function ensureBankAccountsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
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
    )
  `);
}

async function ensureWithdrawalRequestsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      bank_account_id BIGINT UNSIGNED NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
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
    )
  `);
}

async function ensureServiceablePincodesTable() {
  await sq(`
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
    )
  `);

  await sq(`
    INSERT INTO serviceable_pincodes (pincode, city, state, shipping_charge, cod_available, estimated_days, is_active) VALUES
      ('400001', 'Mumbai', 'Maharashtra', 49.00, 1, 2, 1),
      ('110001', 'New Delhi', 'Delhi', 59.00, 1, 3, 1),
      ('560001', 'Bengaluru', 'Karnataka', 55.00, 1, 3, 1),
      ('700001', 'Kolkata', 'West Bengal', 52.00, 0, 4, 1)
    ON DUPLICATE KEY UPDATE
      city = VALUES(city),
      state = VALUES(state),
      shipping_charge = VALUES(shipping_charge),
      cod_available = VALUES(cod_available),
      estimated_days = VALUES(estimated_days),
      is_active = VALUES(is_active)
  `);
}

async function ensureOrderItemsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NULL,
      product_name VARCHAR(180) NOT NULL,
      product_slug VARCHAR(200) NULL,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
      line_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_items_order (order_id)
    )
  `);
}

async function ensureSettingsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) NOT NULL PRIMARY KEY,
      \`value\` TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await sq(`
    INSERT INTO settings (\`key\`, \`value\`) VALUES
      ('cod_enabled', 'true'),
      ('default_shipping_fee', '49'),
      ('free_shipping_above', '999'),
      ('business_state_code', '27')
    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)
  `);
}

async function ensureCommissionManualAdjustmentsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS commission_manual_adjustments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      order_id INT UNSIGNED NULL,
      adjustment_type VARCHAR(80) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      action ENUM('credit', 'debit') NOT NULL,
      reason VARCHAR(500) NOT NULL,
      apply_to_wallet TINYINT(1) NOT NULL DEFAULT 0,
      wallet_transaction_id INT UNSIGNED NULL,
      commission_transaction_id BIGINT UNSIGNED NULL,
      metadata_json JSON NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_man_user (user_id),
      INDEX idx_man_order (order_id),
      INDEX idx_man_created (created_at)
    )
  `);
}

async function ensureStorefrontAndCommerceTables() {
  await ensureCategoriesTable();
  await ensureBrandsTable();
  await ensureProductsTable();
  await ensureBannersTable();
  await ensurePaymentsTable();
  await ensureProductReviewsTable();
  await ensureCartItemsTable();
  await ensureBankAccountsTable();
  await ensureWithdrawalRequestsTable();
  await ensureServiceablePincodesTable();
  await ensureSettingsTable();
}

/** Must run after `users`, before tables that logically depend on orders (e.g. commission rows with `order_id`). */
async function ensureOrdersTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
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
      INDEX idx_orders_user (user_id),
      INDEX idx_orders_number (order_number),
      INDEX idx_orders_status (status),
      INDEX idx_orders_invoice (invoice_number)
    )
  `);
}

async function ensureReferralTreeStatsTable() {
  await sq(`
    CREATE TABLE IF NOT EXISTS referral_tree_stats (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      total_left_members INT NOT NULL DEFAULT 0,
      total_right_members INT NOT NULL DEFAULT 0,
      total_left_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
      total_right_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureReferralSchemaTables() {
  await ensureUsersTable();
  await ensureOrdersTable();

  await sq(`
    CREATE TABLE IF NOT EXISTS referral_users (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      referral_code VARCHAR(20) NOT NULL,
      sponsor_user_id INT UNSIGNED NULL,
      level INT NOT NULL DEFAULT 1,
      placement_parent_user_id INT UNSIGNED NULL,
      placement_side ENUM('left', 'right') NULL,
      welcome_bonus_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_referral_users_code (referral_code),
      UNIQUE KEY unique_position (placement_parent_user_id, placement_side),
      INDEX idx_referral_sponsor (sponsor_user_id),
      INDEX idx_parent (placement_parent_user_id)
    )
  `);

  await ensureReferralTreeStatsTable();

  await sq(`
    CREATE TABLE IF NOT EXISTS referral_closure (
      ancestor_user_id INT UNSIGNED NOT NULL,
      descendant_user_id INT UNSIGNED NOT NULL,
      depth INT NOT NULL,
      leg_side ENUM('left', 'right') NULL COMMENT 'First step from ancestor binary toward descendant; NULL for self depth 0',
      PRIMARY KEY (ancestor_user_id, descendant_user_id),
      INDEX idx_closure_desc (descendant_user_id)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS binary_carry (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      left_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
      right_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_binary_carry_matchable (left_profit_carry, right_profit_carry)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS binary_daily_summary (
      user_id INT UNSIGNED NOT NULL,
      summary_date DATE NOT NULL,
      binary_paid_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      ceiling_blocked_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, summary_date)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS binary_payout_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      payout_date DATE NOT NULL,
      matched_bv DECIMAL(14,2) NOT NULL,
      gross_income DECIMAL(14,2) NOT NULL,
      tds_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      admin_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
      net_wallet_amount DECIMAL(14,2) NOT NULL,
      wallet_transaction_id INT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_binary (user_id, payout_date),
      INDEX idx_binary_payout_user (user_id)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS commission_transactions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      order_id INT UNSIGNED NULL,
      commission_type ENUM('welcome_bonus', 'direct_referral', 'binary_match', 'binary_ceiling_hold', 'manual_adjustment') NOT NULL,
      gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      wallet_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      ceiling_blocked_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      wallet_transaction_id INT UNSIGNED NULL,
      metadata_json JSON NULL,
      settings_snapshot_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_comm_user (user_id),
      INDEX idx_comm_order (order_id),
      INDEX idx_comm_type (commission_type)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user_created (user_id, created_at)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS system_alerts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      alert_type VARCHAR(64) NOT NULL,
      severity ENUM('info', 'warning', 'danger') NOT NULL DEFAULT 'warning',
      message TEXT NOT NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_system_alerts_created (created_at),
      INDEX idx_system_alerts_type (alert_type)
    )
  `);
}

async function ensureKycAndScoreTables() {
  await sq(`
    CREATE TABLE IF NOT EXISTS kyc_records (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      tier ENUM('L1', 'L2') NOT NULL DEFAULT 'L1',
      pan_number VARCHAR(20) NOT NULL,
      aadhaar_number VARCHAR(20) NULL,
      document_url TEXT NOT NULL,
      selfie_url TEXT NULL,
      status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
      rejection_reason TEXT NULL,
      verified_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_kyc_user_status (user_id, status),
      INDEX idx_kyc_created (created_at)
    )
  `);
  await sq(`
    CREATE TABLE IF NOT EXISTS user_scores (
      user_id INT UNSIGNED NOT NULL PRIMARY KEY,
      score INT NOT NULL DEFAULT 0,
      level VARCHAR(20) NOT NULL DEFAULT 'Bronze',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureIndiaComplianceArtifacts() {
  await sq(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      status ENUM('open','resolved') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_complaints_user (user_id),
      INDEX idx_complaints_status (status)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id INT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    )
  `);

  await sq(`
    CREATE TABLE IF NOT EXISTS payouts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      withdrawal_request_id INT UNSIGNED NULL,
      user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
      reference_id VARCHAR(100) NULL,
      provider VARCHAR(40) NOT NULL DEFAULT 'razorpay',
      error_message VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_payouts_withdrawal (withdrawal_request_id),
      INDEX idx_payouts_user (user_id),
      INDEX idx_payouts_status (status)
    )
  `);
}

async function ensureFraudArtifacts() {
  await sq(`
    CREATE TABLE IF NOT EXISTS fraud_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      risk_score INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fraud_user (user_id),
      INDEX idx_fraud_created (created_at),
      INDEX idx_fraud_type (type)
    )
  `);
}

async function bootstrapReferralSchemaOnce() {
  await ensureCoreAuthSchema();
  await ensureUsersComplianceColumns();
  await ensureStorefrontAndCommerceTables();
  await ensureReferralSchemaTables();
  await ensureOrderItemsTable();
  await ensureCommissionManualAdjustmentsTable();
  await ensureKycAndScoreTables();
  await ensureFraudArtifacts();
  await ensureIndiaComplianceArtifacts();
}

export async function ensureReferralSchemaExists(dedicatedConnection?: Connection) {
  if (referralSchemaReady) return;
  if (!referralSchemaPromise) {
    const runBootstrap = async () => {
      const prev = schemaBootstrapSql;
      if (dedicatedConnection) {
        schemaBootstrapSql = async (sql, params = []) => {
          const [rows] = await dedicatedConnection.query(sql, params as any);
          return rows;
        };
      }
      try {
        await bootstrapReferralSchemaOnce();
      } finally {
        schemaBootstrapSql = prev;
      }
    };

    referralSchemaPromise = runBootstrap()
      .then(() => {
        referralSchemaReady = true;
      })
      .catch((error) => {
        referralSchemaPromise = null;
        throw error;
      });
  }
  await referralSchemaPromise;
}

export const ensureApplicationSchemaExists = ensureReferralSchemaExists;
