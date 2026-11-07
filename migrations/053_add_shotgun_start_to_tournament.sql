SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'shotgun_start'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE tournament ADD COLUMN shotgun_start TINYINT(1) NOT NULL DEFAULT 0 AFTER first_tee_time',
  'SELECT ''Column shotgun_start already exists in tournament'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
