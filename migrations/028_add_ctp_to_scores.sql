-- Add closest to pin (CTP) fields to scores table
ALTER TABLE scores
ADD COLUMN ctp_feet INT UNSIGNED DEFAULT NULL,
ADD COLUMN ctp_inches DECIMAL(3,1) DEFAULT NULL,
ADD COLUMN ctp_image_url VARCHAR(255) DEFAULT NULL;
