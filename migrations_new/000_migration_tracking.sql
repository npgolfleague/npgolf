-- Migration Tracking Table
-- Add this to track which migrations have been applied

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_migration_name (migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert baseline migration
INSERT INTO schema_migrations (migration_name) VALUES ('001_baseline_schema.sql')
ON DUPLICATE KEY UPDATE migration_name = migration_name;
