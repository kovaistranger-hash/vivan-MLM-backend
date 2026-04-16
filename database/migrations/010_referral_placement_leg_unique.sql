-- At most one member per binary leg under a placement parent (DB integrity + concurrent placement).
-- If ALTER fails, find duplicates with:
--   SELECT placement_parent_user_id, placement_side, COUNT(*) c FROM referral_users
--   WHERE placement_parent_user_id IS NOT NULL AND placement_side IS NOT NULL
--   GROUP BY placement_parent_user_id, placement_side HAVING c > 1;
-- Run: mysql -u root -p vivan < database/migrations/010_referral_placement_leg_unique.sql

USE vivan;

ALTER TABLE referral_users
  ADD UNIQUE KEY uq_referral_placement_leg (placement_parent_user_id, placement_side);
