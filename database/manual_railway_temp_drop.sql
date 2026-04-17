-- Paste into Railway → MySQL → Database (or any MySQL client).
-- Order matches app bootstrap; disables FK checks so drops succeed regardless of order.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS commission_transactions;
DROP TABLE IF EXISTS binary_carry;
DROP TABLE IF EXISTS referral_closure;
DROP TABLE IF EXISTS referral_users;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;
