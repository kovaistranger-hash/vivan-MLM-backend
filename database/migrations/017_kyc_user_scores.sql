-- India-style KYC audit trail + gamified user score cache.
-- App bootstrap in `referralSchema.service` also creates these if missing.

USE vivan;

CREATE TABLE IF NOT EXISTS kyc_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  tier ENUM('L1', 'L2') NOT NULL DEFAULT 'L1',
  pan_number VARCHAR(20) NOT NULL,
  aadhaar_number VARCHAR(20) NULL COMMENT 'Store masked reference only in production',
  document_url TEXT NOT NULL,
  selfie_url TEXT NULL COMMENT 'Required for L2 submissions',
  status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_kyc_user_status (user_id, status),
  INDEX idx_kyc_created (created_at)
);

CREATE TABLE IF NOT EXISTS user_scores (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  score INT NOT NULL DEFAULT 0,
  level VARCHAR(20) NOT NULL DEFAULT 'Bronze',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- users.kyc_level is added by app bootstrap if missing (see referralSchema.service).
