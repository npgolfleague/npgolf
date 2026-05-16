-- Remove global unique constraint on players.email
-- Email uniqueness will now be enforced per-league at the application level

SET @index_exists = (
	SELECT COUNT(*)
	FROM information_schema.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'players'
		AND INDEX_NAME = 'email'
);

SET @sql = IF(@index_exists > 0,
	'ALTER TABLE players DROP INDEX email',
	'SELECT ''Index email does not exist on players'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
