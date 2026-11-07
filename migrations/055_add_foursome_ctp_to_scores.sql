-- Guard: only alter if column doesn't exist (MySQL 8 doesn't support IF NOT EXISTS in ALTER TABLE)
SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scores' AND COLUMN_NAME = 'foursome_ctp_feet');
SET @sql = IF(@col = 0,
  'ALTER TABLE scores ADD COLUMN foursome_ctp_feet INT UNSIGNED DEFAULT NULL, ADD COLUMN foursome_ctp_inches DECIMAL(3,1) DEFAULT NULL, ADD COLUMN foursome_ctp_image_url MEDIUMTEXT DEFAULT NULL',
  'SELECT ''foursome_ctp columns already exist''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
