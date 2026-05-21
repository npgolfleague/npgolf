-- Add SMS allowed flag to players table
ALTER TABLE players ADD COLUMN sms_allowed TINYINT(1) NOT NULL DEFAULT 0;
