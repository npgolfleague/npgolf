-- Update settings to reflect new fee structure
-- 9-hole: $5 required (quota), $5 optional (skins/CTP)
-- 18-hole: $10 required (quota), $10 optional (skins/CTP)

ALTER TABLE settings
ADD COLUMN skins_ctp_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Optional skins/CTP fee for 18 hole events' AFTER tournament_fee_18_holes,
ADD COLUMN skins_ctp_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 5.00 COMMENT 'Optional skins/CTP fee for 9 hole events' AFTER tournament_fee_9_holes;

-- Update existing default fees to match new structure
UPDATE settings 
SET tournament_fee_18_holes = 10.00,
    tournament_fee_9_holes = 5.00,
    skins_ctp_fee_18_holes = 10.00,
    skins_ctp_fee_9_holes = 5.00
WHERE id = 1;
