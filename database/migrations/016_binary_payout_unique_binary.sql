-- Idempotency: one cron payout row per user per IST calendar day (same as prior uq_binary_payout_user_day).
-- Run only if your DB still has the old index name from migration 012.
-- Run: mysql -u root -p vivan < database/migrations/016_binary_payout_unique_binary.sql

USE vivan;

ALTER TABLE binary_payout_logs
  DROP INDEX uq_binary_payout_user_day,
  ADD UNIQUE KEY unique_binary (user_id, payout_date);
