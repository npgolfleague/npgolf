-- Add password reset token support to players table
ALTER TABLE players
  ADD COLUMN reset_password_token_hash VARCHAR(64) NULL,
  ADD COLUMN reset_password_expires DATETIME NULL;
