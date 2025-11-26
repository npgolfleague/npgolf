-- 002_add_password_column.sql
-- Add password column to users table (nullable for backwards compatibility)
USE npgolf;
-- Use a conditional ALTER via dynamic SQL so the migration is idempotent across MySQL versions
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'npgolf' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password');
SET @sql = IF(@exists = 0, 'ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT NULL', 'SELECT "password column already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
