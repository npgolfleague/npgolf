-- Add refresh token storage to players for long-lived session support
ALTER TABLE players
  ADD COLUMN refresh_token_hash VARCHAR(255) NULL,
  ADD COLUMN refresh_token_expires DATETIME NULL;
