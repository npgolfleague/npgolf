-- 002_add_password_column.sql
-- Add password column to users table (nullable for backwards compatibility)
USE npgolf;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT NULL;
