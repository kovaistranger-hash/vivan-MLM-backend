-- Optional KYC flag for withdrawal gating (used when withdrawal_settings.kyc_required = 1)
USE vivan;

ALTER TABLE users
  ADD COLUMN kyc_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
