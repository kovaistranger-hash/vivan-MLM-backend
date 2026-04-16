-- Single binary commission rate on matched carry (replaces summing left+right leg %).
-- Run: mysql -u root -p vivan < database/migrations/013_binary_percentage.sql

USE vivan;

ALTER TABLE compensation_settings
  ADD COLUMN binary_percentage DECIMAL(8,4) NOT NULL DEFAULT 10.0000
  COMMENT 'Single % of matched carry paid as binary gross (before fees/caps)'
  AFTER binary_right_percentage;

UPDATE compensation_settings
SET binary_percentage = ROUND(LEAST(binary_left_percentage, binary_right_percentage), 4)
WHERE id = 1;
