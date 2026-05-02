-- Add separate 18-hole and 9-hole quota columns
-- Rename existing quota to quota_18 and add quota_9
ALTER TABLE players CHANGE COLUMN quota quota_18 INT DEFAULT NULL;
ALTER TABLE players ADD COLUMN quota_9 INT DEFAULT NULL AFTER quota_18;
