-- Financial / system risk audit trail
-- Run: mysql -u root -p vivan < database/migrations/015_system_alerts.sql

USE vivan;

CREATE TABLE IF NOT EXISTS system_alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_type VARCHAR(64) NOT NULL,
  severity ENUM('info', 'warning', 'danger') NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_system_alerts_created (created_at),
  INDEX idx_system_alerts_type (alert_type)
);
