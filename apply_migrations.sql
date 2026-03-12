-- Apply migrations 035 and 036

-- Migration 035: Add skins_ctp_paid column
ALTER TABLE tournament_players
ADD COLUMN skins_ctp_paid TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)';

-- Migration 036: Add skins_ctp_fee columns and update existing fees
ALTER TABLE settings
ADD COLUMN skins_ctp_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Optional skins/CTP fee for 18 hole events',
ADD COLUMN skins_ctp_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 5.00 COMMENT 'Optional skins/CTP fee for 9 hole events';

-- Update existing fees to match new structure
UPDATE settings 
SET tournament_fee_18_holes = 10.00,
    tournament_fee_9_holes = 5.00,
    skins_ctp_fee_18_holes = 10.00,
    skins_ctp_fee_9_holes = 5.00
WHERE id = 1;
