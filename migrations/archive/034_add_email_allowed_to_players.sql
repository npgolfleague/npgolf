-- Add email_allowed column to players table
ALTER TABLE players 
ADD COLUMN email_allowed TINYINT(1) NOT NULL DEFAULT 1 AFTER sms_allowed;
