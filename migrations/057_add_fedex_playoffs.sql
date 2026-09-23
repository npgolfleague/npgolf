-- Migration 057: Add league-scoped playoff configuration and season-scoped playoff tracking
--
-- Rollback notes:
-- 1. Back up any rows in league_seasons, season_player_stats, and tournament_playoff_points first.
-- 2. Remove playoff data rows before dropping the tables/columns below.
-- 3. Keep league_settings.playoff_format only if you want to preserve the league opt-in flag.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS league_seasons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  league_id INT UNSIGNED NOT NULL,
  season_year INT UNSIGNED NOT NULL,
  championship_pot DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  losers_bracket_pot DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  champion_player_id INT UNSIGNED DEFAULT NULL,
  champion_tiebreak_player_id INT UNSIGNED DEFAULT NULL,
  losers_winner_player_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_league_season (league_id, season_year),
  KEY idx_league_id (league_id),
  KEY idx_season_year (season_year),
  CONSTRAINT fk_league_seasons_league
    FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @schema_name = DATABASE();

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'season_id'
);
SET @sql = IF(
  @has_col = 0,
  'ALTER TABLE tournament ADD COLUMN season_id INT UNSIGNED DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'playoff_stage'
);
SET @sql = IF(
  @has_col = 0,
  "ALTER TABLE tournament ADD COLUMN playoff_stage ENUM('regular', 'semifinal', 'final') NOT NULL DEFAULT 'regular'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'playoff_override_semifinal_player_ids'
);
SET @sql = IF(
  @has_col = 0,
  'ALTER TABLE tournament ADD COLUMN playoff_override_semifinal_player_ids JSON DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'playoff_override_final_player_ids'
);
SET @sql = IF(
  @has_col = 0,
  'ALTER TABLE tournament ADD COLUMN playoff_override_final_player_ids JSON DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND INDEX_NAME = 'idx_season_id'
);
SET @sql = IF(
  @has_idx = 0,
  'ALTER TABLE tournament ADD KEY idx_season_id (season_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'tournament'
    AND INDEX_NAME = 'idx_playoff_stage'
);
SET @sql = IF(
  @has_idx = 0,
  'ALTER TABLE tournament ADD KEY idx_playoff_stage (playoff_stage)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'league_settings'
    AND COLUMN_NAME = 'playoff_format'
);
SET @sql = IF(
  @has_col = 0,
  "ALTER TABLE league_settings ADD COLUMN playoff_format ENUM('none', 'fedex_cup') NOT NULL DEFAULT 'none'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS season_player_stats (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  season_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  regular_points DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  playoff_points DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  losers_bracket_points DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_season_player (season_id, player_id),
  KEY idx_sps_season_id (season_id),
  KEY idx_sps_player_id (player_id),
  CONSTRAINT fk_sps_season
    FOREIGN KEY (season_id) REFERENCES league_seasons (id) ON DELETE CASCADE,
  CONSTRAINT fk_sps_player
    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tournament_playoff_points (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  season_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  bracket_type ENUM('playoff', 'losers') NOT NULL,
  result_type ENUM('seed', 'performance') NOT NULL,
  playoff_week TINYINT UNSIGNED NOT NULL,
  rank_position INT UNSIGNED DEFAULT NULL,
  tie_group_size INT UNSIGNED NOT NULL DEFAULT 1,
  over_under DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  points_awarded DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  cumulative_points_after DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_player_result (tournament_id, player_id, bracket_type, result_type),
  KEY idx_tpp_tournament_id (tournament_id),
  KEY idx_tpp_season_id (season_id),
  KEY idx_tpp_player_id (player_id),
  KEY idx_tpp_bracket_type (bracket_type),
  CONSTRAINT fk_tpp_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_tpp_season
    FOREIGN KEY (season_id) REFERENCES league_seasons (id) ON DELETE CASCADE,
  CONSTRAINT fk_tpp_player
    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO league_seasons (league_id, season_year)
SELECT l.id, COALESCE(l.season_year, YEAR(CURDATE()))
FROM leagues l
ON DUPLICATE KEY UPDATE season_year = VALUES(season_year);

UPDATE tournament t
JOIN leagues l ON l.id = t.league_id
JOIN league_seasons ls
  ON ls.league_id = l.id
 AND ls.season_year = COALESCE(l.season_year, YEAR(t.date), YEAR(CURDATE()))
SET t.season_id = ls.id
WHERE t.season_id IS NULL;

INSERT INTO season_player_stats (season_id, player_id, regular_points, playoff_points, losers_bracket_points)
SELECT
  t.season_id,
  tpp.player_id,
  COALESCE(SUM(tpp.points_awarded), 0),
  0,
  0
FROM tournament_paradise_points tpp
JOIN tournament t ON t.id = tpp.tournament_id
WHERE t.season_id IS NOT NULL
  AND t.playoff_stage = 'regular'
GROUP BY t.season_id, tpp.player_id
ON DUPLICATE KEY UPDATE regular_points = VALUES(regular_points);

ALTER TABLE tournament
  MODIFY COLUMN season_id INT UNSIGNED DEFAULT NULL;

SET @has_fk = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND CONSTRAINT_NAME = 'fk_tournament_season'
    AND TABLE_NAME = 'tournament'
);
SET @sql = IF(
  @has_fk = 0,
  'ALTER TABLE tournament ADD CONSTRAINT fk_tournament_season FOREIGN KEY (season_id) REFERENCES league_seasons (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
