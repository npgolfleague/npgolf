SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'leagues'
    AND COLUMN_NAME = 'cup_name'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE leagues ADD COLUMN cup_name VARCHAR(191) NOT NULL DEFAULT ''Paradise Cup'' AFTER slug',
  'SELECT ''Column cup_name already exists in leagues'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
