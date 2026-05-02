-- Ensure attendance columns exist, then convert pending responses to yes
-- This is safe for environments where 032 may have been skipped.

SET @has_attending_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament_players'
    AND COLUMN_NAME = 'attending_status'
);

SET @sql_add_attending_status := IF(
  @has_attending_status = 0,
  "ALTER TABLE tournament_players ADD COLUMN attending_status ENUM('pending','yes','no') DEFAULT 'yes'",
  'SELECT 1'
);
PREPARE stmt_add_attending_status FROM @sql_add_attending_status;
EXECUTE stmt_add_attending_status;
DEALLOCATE PREPARE stmt_add_attending_status;

SET @has_response_date := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament_players'
    AND COLUMN_NAME = 'response_date'
);

SET @sql_add_response_date := IF(
  @has_response_date = 0,
  "ALTER TABLE tournament_players ADD COLUMN response_date TIMESTAMP NULL DEFAULT NULL",
  'SELECT 1'
);
PREPARE stmt_add_response_date FROM @sql_add_response_date;
EXECUTE stmt_add_response_date;
DEALLOCATE PREPARE stmt_add_response_date;

UPDATE tournament_players
SET attending_status = 'yes',
    response_date = COALESCE(response_date, NOW())
WHERE attending_status = 'pending';
