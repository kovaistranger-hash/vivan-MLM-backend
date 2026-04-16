-- Grievance + audit + payout log tables (idempotent). Column changes for users/orders are applied by app bootstrap.

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
