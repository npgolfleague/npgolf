SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'outgoing_email_from'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN outgoing_email_from VARCHAR(255) NULL COMMENT ''Optional FROM address for outgoing league emails'' AFTER golf_course_email',
  'SELECT ''Column outgoing_email_from already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
