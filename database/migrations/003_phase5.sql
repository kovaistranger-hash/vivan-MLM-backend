-- Phase 5: invoices, pincode delivery, Cloudinary-ready schema additions
-- Run: mysql -u root -p vivan < database/migrations/003_phase5.sql

USE vivan;

ALTER TABLE orders
  ADD COLUMN invoice_number VARCHAR(40) NULL UNIQUE AFTER order_number;

CREATE TABLE IF NOT EXISTS serviceable_pincodes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pincode VARCHAR(12) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  shipping_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  cod_available TINYINT(1) NOT NULL DEFAULT 1,
  estimated_days INT NOT NULL DEFAULT 3,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_serviceable_pincode (pincode),
  INDEX idx_pincode_active (pincode, is_active)
);

INSERT INTO serviceable_pincodes (pincode, city, state, shipping_charge, cod_available, estimated_days, is_active) VALUES
  ('400001', 'Mumbai', 'Maharashtra', 49.00, 1, 2, 1),
  ('110001', 'New Delhi', 'Delhi', 59.00, 1, 3, 1),
  ('560001', 'Bengaluru', 'Karnataka', 55.00, 1, 3, 1),
  ('700001', 'Kolkata', 'West Bengal', 52.00, 0, 4, 1)
ON DUPLICATE KEY UPDATE city = VALUES(city), state = VALUES(state);
