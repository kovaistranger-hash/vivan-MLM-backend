import { query } from '../../db/mysql.js';

let referralSchemaReady = false;
let referralSchemaPromise: Promise<void> | null = null;

async function columnExists(tableName: string, columnName: string) {
  const rows = await query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND COLUMN_NAME = :columnName`,
    { tableName, columnName }
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function tableExists(tableName: string) {
  const rows = await query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName`,
    { tableName }
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(tableName: string, indexName: string) {
  const rows = await query<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND INDEX_NAME = :indexName`,
    { tableName, indexName }
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureBinaryCarryMatchableIndex() {
  if (!(await tableExists('binary_carry'))) return;
  if (await indexExists('binary_carry', 'idx_binary_carry_matchable')) return;
  await query(
    `ALTER TABLE binary_carry ADD INDEX idx_binary_carry_matchable (left_profit_carry, right_profit_carry)`
  );
}

async function ensureCompensationBinaryPercentageColumn() {
  const tbl = await query<Array<{ c: number }>>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compensation_settings'`
  );
  if (!tbl[0] || Number(tbl[0].c) === 0) return;
  if (await columnExists('compensation_settings', 'binary_percentage')) return;
  await query(
    `ALTER TABLE compensation_settings
       ADD COLUMN binary_percentage DECIMAL(8,4) NOT NULL DEFAULT 10.0000
       COMMENT 'Single % of matched carry (binary gross before fees/caps)'
       AFTER binary_right_percentage`
  );
  await query(
    `UPDATE compensation_settings
     SET binary_percentage = ROUND(LEAST(binary_left_percentage, binary_right_percentage), 4)
     WHERE id = 1`
  );
}

async function ensureReferralSchemaColumns() {
  const orderColumns: Array<{ name: string; definition: string }> = [
    { name: 'profit_amount', definition: 'DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal' },
    { name: 'commission_processed_at', definition: 'DATETIME NULL AFTER profit_amount' },
    { name: 'commission_status', definition: 'VARCHAR(40) NULL AFTER commission_processed_at' },
    { name: 'commission_audit_json', definition: 'JSON NULL AFTER commission_status' }
  ];

  for (const column of orderColumns) {
    if (await columnExists('orders', column.name)) continue;
    await query(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.definition}`);
  }
}

async function ensureReferralUsersMlmColumns() {
  if (!(await columnExists('referral_users', 'level'))) {
    await query(
      `ALTER TABLE referral_users ADD COLUMN level INT NOT NULL DEFAULT 1 AFTER sponsor_user_id`
    );
  }
}

async function ensureReferralTreeStatsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS referral_tree_stats (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      total_left_members INT NOT NULL DEFAULT 0,
      total_right_members INT NOT NULL DEFAULT 0,
      total_left_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
      total_right_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

async function ensureReferralSchemaTables() {
  await query(`
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
      UNIQUE KEY unique_position (placement_parent_user_id, placement_side),
      INDEX idx_referral_sponsor (sponsor_user_id),
      INDEX idx_parent (placement_parent_user_id),
      CONSTRAINT fk_ref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ref_sponsor FOREIGN KEY (sponsor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_ref_placement_parent FOREIGN KEY (placement_parent_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS referral_closure (
      ancestor_user_id BIGINT UNSIGNED NOT NULL,
      descendant_user_id BIGINT UNSIGNED NOT NULL,
      depth INT NOT NULL,
      leg_side ENUM('left', 'right') NULL COMMENT 'First step from ancestor binary toward descendant; NULL for self depth 0',
      PRIMARY KEY (ancestor_user_id, descendant_user_id),
      INDEX idx_closure_desc (descendant_user_id),
      CONSTRAINT fk_closure_anc FOREIGN KEY (ancestor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_closure_desc FOREIGN KEY (descendant_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS binary_carry (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      left_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
      right_profit_carry DECIMAL(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_binary_carry_matchable (left_profit_carry, right_profit_carry),
      CONSTRAINT fk_binary_carry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS commission_transactions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NULL,
      commission_type ENUM('welcome_bonus', 'direct_referral', 'binary_match', 'binary_ceiling_hold', 'manual_adjustment') NOT NULL,
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
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS binary_daily_summary (
      user_id BIGINT UNSIGNED NOT NULL,
      summary_date DATE NOT NULL,
      binary_paid_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      ceiling_blocked_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, summary_date),
      CONSTRAINT fk_bin_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await query(`
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
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user_created (user_id, created_at),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS system_alerts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_records (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
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
      INDEX idx_kyc_created (created_at),
      CONSTRAINT fk_kyc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS user_scores (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      score INT NOT NULL DEFAULT 0,
      level VARCHAR(20) NOT NULL DEFAULT 'Bronze',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_scores_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  if (!(await columnExists('users', 'kyc_level'))) {
    await query(
      `ALTER TABLE users ADD COLUMN kyc_level TINYINT NOT NULL DEFAULT 0 COMMENT '0=L0,1=L1,2=L2' AFTER kyc_verified`
    );
  }
}

async function ensureIndiaComplianceArtifacts() {
  if (!(await columnExists('users', 'gst_number'))) {
    await query(`ALTER TABLE users ADD COLUMN gst_number VARCHAR(20) NULL AFTER phone`);
  }
  if (!(await columnExists('users', 'accepted_terms'))) {
    await query(
      `ALTER TABLE users ADD COLUMN accepted_terms TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Terms + policies accepted at registration' AFTER is_active`
    );
  }
  if (!(await columnExists('orders', 'invoice_url'))) {
    await query(`ALTER TABLE orders ADD COLUMN invoice_url VARCHAR(512) NULL AFTER invoice_number`);
  }

  await query(`
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
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      action TEXT NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await query(`
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
    )
  `);
}

async function ensureFraudArtifacts() {
  await query(`
    CREATE TABLE IF NOT EXISTS fraud_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      risk_score INT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fraud_user (user_id),
      INDEX idx_fraud_created (created_at),
      INDEX idx_fraud_type (type),
      CONSTRAINT fk_fraud_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  if (!(await columnExists('users', 'signup_ip'))) {
    await query(`ALTER TABLE users ADD COLUMN signup_ip VARCHAR(45) NULL AFTER phone`);
  }
  if (!(await columnExists('wallets', 'is_locked'))) {
    await query(
      `ALTER TABLE wallets ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active`
    );
  }
}

async function ensureReferralUsersPlacementConstraints() {
  if (!(await tableExists('referral_users'))) return;
  if (
    !(await indexExists('referral_users', 'uq_referral_placement_leg')) &&
    !(await indexExists('referral_users', 'unique_position'))
  ) {
    await query(
      `ALTER TABLE referral_users
         ADD UNIQUE KEY unique_position (placement_parent_user_id, placement_side)`
    );
  }
  if (
    !(await indexExists('referral_users', 'idx_referral_placement_parent')) &&
    !(await indexExists('referral_users', 'idx_referral_users_placement_parent')) &&
    !(await indexExists('referral_users', 'idx_parent'))
  ) {
    await query(`ALTER TABLE referral_users ADD INDEX idx_parent (placement_parent_user_id)`);
  }
}

async function ensureCleanArchitectureIndexes() {
  await ensureReferralUsersPlacementConstraints();
  if (!(await columnExists('users', 'is_blocked'))) {
    await query(
      `ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Admin/system account block' AFTER is_active`
    );
  }
}

async function ensureUsersRankAndExpoTokenColumns() {
  if (!(await columnExists('users', 'rank'))) {
    await query(
      `ALTER TABLE users ADD COLUMN \`rank\` VARCHAR(50) NOT NULL DEFAULT 'Starter' COMMENT 'MLM rank from team BV' AFTER email`
    );
  }
  if (!(await columnExists('users', 'expo_token'))) {
    await query(`ALTER TABLE users ADD COLUMN expo_token VARCHAR(512) NULL COMMENT 'Expo push token' AFTER phone`);
  }
}

async function bootstrapReferralSchemaOnce() {
  await ensureReferralSchemaTables();
  await ensureReferralUsersMlmColumns();
  await ensureReferralTreeStatsTable();
  await ensureReferralSchemaColumns();
  await ensureCompensationBinaryPercentageColumn();
  await ensureBinaryCarryMatchableIndex();
  await ensureKycAndScoreTables();
  await ensureFraudArtifacts();
  await ensureIndiaComplianceArtifacts();
  await ensureCleanArchitectureIndexes();
  await ensureUsersRankAndExpoTokenColumns();
}

export async function ensureReferralSchemaExists() {
  if (referralSchemaReady) return;
  if (!referralSchemaPromise) {
    referralSchemaPromise = bootstrapReferralSchemaOnce()
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
