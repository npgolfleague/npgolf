SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'live_scoring'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE league_settings ADD COLUMN live_scoring TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''If 1, scores are visible on leaderboard as they are entered. If 0, only visible after foursome posts scores.''' ,
  'SELECT ''Column live_scoring already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
