-- Ensure players.email is NOT globally unique
-- Required so the same email can register in different leagues.

SET @email_unique_index = (
  SELECT s.INDEX_NAME
  FROM information_schema.STATISTICS s
  WHERE s.TABLE_SCHEMA = DATABASE()
    AND s.TABLE_NAME = 'players'
  GROUP BY s.INDEX_NAME
  HAVING MAX(s.NON_UNIQUE) = 0
     AND COUNT(*) = 1
     AND MAX(s.COLUMN_NAME) = 'email'
  ORDER BY s.INDEX_NAME
  LIMIT 1
);

SET @sql = IF(
  @email_unique_index IS NULL,
  'SELECT ''No unique index on players.email found'' AS message',
  CONCAT('ALTER TABLE players DROP INDEX `', @email_unique_index, '`')
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
