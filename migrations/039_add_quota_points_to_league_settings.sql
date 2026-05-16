-- Add quota point values to league_settings so each league can configure them
-- Default values match the current hardcoded values in tournaments.js

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_albatross'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_albatross INT NOT NULL DEFAULT 8 COMMENT ''Points for albatross (3 under par)''',
  'SELECT ''Column quota_points_albatross already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_eagle'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_eagle INT NOT NULL DEFAULT 8 COMMENT ''Points for eagle (2 under par)''',
  'SELECT ''Column quota_points_eagle already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_birdie'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_birdie INT NOT NULL DEFAULT 6 COMMENT ''Points for birdie (1 under par)''',
  'SELECT ''Column quota_points_birdie already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_par'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_par INT NOT NULL DEFAULT 4 COMMENT ''Points for par''',
  'SELECT ''Column quota_points_par already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_bogey'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_bogey INT NOT NULL DEFAULT 2 COMMENT ''Points for bogey (1 over par)''',
  'SELECT ''Column quota_points_bogey already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_double_bogey'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_double_bogey INT NOT NULL DEFAULT 1 COMMENT ''Points for double bogey (2 over par)''',
  'SELECT ''Column quota_points_double_bogey already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'quota_points_worse'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_points_worse INT NOT NULL DEFAULT 0 COMMENT ''Points for worse than double bogey''',
  'SELECT ''Column quota_points_worse already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
