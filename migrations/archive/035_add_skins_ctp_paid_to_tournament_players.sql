-- Add flag to track skins/CTP optional fee payment
ALTER TABLE tournament_players
ADD COLUMN skins_ctp_paid TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)';
