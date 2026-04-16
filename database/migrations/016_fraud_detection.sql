-- Fraud detection audit + optional columns (wallet lock, signup IP).
-- Run: mysql -u root -p vivan < database/migrations/016_fraud_detection.sql
-- App also ensures columns via `referralSchema` bootstrap if you deploy without running SQL manually.

USE vivan;

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
);
