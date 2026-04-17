import { query } from '../../db/mysql.js';
/** When set (during `initDB` bootstrap), all DDL uses this executor so FK/session flags apply on one connection. */
let schemaBootstrapSql = null;
async function sq(sql, params = []) {
    if (schemaBootstrapSql) {
        return (await schemaBootstrapSql(sql, params));
    }
    return query(sql, params);
}
let referralSchemaReady = false;
let referralSchemaPromise = null;
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
    await ensureReferralSchemaTables();
    await ensureKycAndScoreTables();
    await ensureFraudArtifacts();
    await ensureIndiaComplianceArtifacts();
}
export async function ensureReferralSchemaExists(dedicatedConnection) {
    if (referralSchemaReady)
        return;
    if (!referralSchemaPromise) {
        const runBootstrap = async () => {
            const prev = schemaBootstrapSql;
            if (dedicatedConnection) {
                schemaBootstrapSql = async (sql, params = []) => {
                    const [rows] = await dedicatedConnection.query(sql, params);
                    return rows;
                };
            }
            try {
                await bootstrapReferralSchemaOnce();
            }
            finally {
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
