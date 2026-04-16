-- MLM / payout query indexes (see `database/schema.sql` for canonical definitions).
--
-- Requested names vs current schema:
--   idx_binary_user ON binary_carry(user_id)
--     → Covered by PRIMARY KEY (user_id) on `binary_carry`.
--   idx_referral_parent ON referral_users(placement_parent_user_id)
--     → Exists as INDEX idx_referral_placement_parent (same column).
--   idx_commission_user ON commission_transactions(user_id)
--     → Exists as INDEX idx_comm_user (user_id).
--
-- Optional: if an older database is missing these, run the matching ALTERs from
-- migrations 010, 014, and the commission section of `schema.sql`.

SELECT 1;
