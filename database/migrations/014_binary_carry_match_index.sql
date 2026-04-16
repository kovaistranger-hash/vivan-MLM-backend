-- Speeds cron scan: WHERE left_profit_carry > 0 AND right_profit_carry > 0
-- Run: mysql -u root -p vivan < database/migrations/014_binary_carry_match_index.sql

USE vivan;

ALTER TABLE binary_carry
  ADD INDEX idx_binary_carry_matchable (left_profit_carry, right_profit_carry);
