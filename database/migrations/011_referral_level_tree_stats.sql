-- Unilevel depth + placement team signals (separate from payout carry in binary_carry).
-- DB leg uniqueness: `uq_referral_placement_leg` on (placement_parent_user_id, placement_side) — see 010_referral_placement_leg_unique.sql.
-- If `level` already exists, skip the ALTER below.
-- Run: mysql -u root -p vivan < database/migrations/011_referral_level_tree_stats.sql

USE vivan;

ALTER TABLE referral_users
  ADD COLUMN level INT NOT NULL DEFAULT 1 AFTER sponsor_user_id;

CREATE TABLE IF NOT EXISTS referral_tree_stats (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  total_left_members INT NOT NULL DEFAULT 0,
  total_right_members INT NOT NULL DEFAULT 0,
  total_left_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_right_bv DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
