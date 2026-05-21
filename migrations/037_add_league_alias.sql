-- Add alias column to leagues table for URL routing
-- Example: npgolf.net/paradise/tournaments

SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'leagues' 
    AND COLUMN_NAME = 'alias'
);

SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE leagues ADD COLUMN alias VARCHAR(50) UNIQUE AFTER slug',
  'SELECT ''Column alias already exists in leagues table'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Set default alias from existing slug for Paradise Golf League
UPDATE leagues 
SET alias = 'paradise' 
WHERE id = 1 AND (alias IS NULL OR alias = '');

-- Add index on alias for faster lookups
SET @index_exists = (
  SELECT COUNT(*) 
  FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'leagues' 
    AND INDEX_NAME = 'idx_alias'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE leagues ADD INDEX idx_alias (alias)',
  'SELECT ''Index idx_alias already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
