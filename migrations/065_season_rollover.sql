-- ============================================================================
-- Migration 065: Season rollover and archive
-- Date: 2026-11-22
--
--   * league_seasons gets a status ('open' / 'closed'), closed_at and
--     closed_by. A closed season is read-only: its tournaments can't be
--     created, edited or completed until an admin reopens it.
--   * season_archive_standings: the frozen final standings of a closed
--     season, one row per player (rank, FedEx points, playoff points,
--     tournaments played, prize money by category, end-of-season quota).
--     Written once when the season is closed, so later recalculations
--     (payouts are rebuilt from paid flags) can't change last season's numbers.
--   * league_player_season_totals (view): FedEx points, tournaments played
--     and prize money per league, season and player. The Dashboard and player
--     list read the current season from here, so a new season starts at 0.
--   * Tournaments with no season_id are assigned to their league's season for
--     the tournament's year, so every result counts toward exactly one season.
--
-- Nothing is deleted: per-tournament results stay where they are.
-- Idempotent: safe to re-run.
-- ============================================================================

SET @s = (SELECT IF(COUNT(*) = 0,
  "ALTER TABLE league_seasons
     ADD COLUMN status ENUM('open', 'closed') NOT NULL DEFAULT 'open' AFTER losers_winner_player_id,
     ADD COLUMN closed_at DATETIME NULL AFTER status,
     ADD COLUMN closed_by INT UNSIGNED NULL AFTER closed_at",
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'league_seasons' AND COLUMN_NAME = 'status');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_seasons ADD CONSTRAINT fk_ls_closed_by FOREIGN KEY (closed_by) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_ls_closed_by');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS season_archive_standings (
  season_id             INT UNSIGNED NOT NULL,
  player_id             INT UNSIGNED NOT NULL,
  player_name           VARCHAR(255) NOT NULL,
  final_rank            INT UNSIGNED NOT NULL,
  fedex_points          INT NOT NULL DEFAULT 0,
  regular_points        DECIMAL(10,2) NOT NULL DEFAULT 0,
  playoff_points        DECIMAL(10,2) NOT NULL DEFAULT 0,
  losers_bracket_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  tournaments_played    INT NOT NULL DEFAULT 0,
  prize_quota           DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_skins           DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_ctp             DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_side_games      DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_money           DECIMAL(10,2) NOT NULL DEFAULT 0,
  end_quota_18          INT NULL,
  end_quota_9           INT NULL,
  archived_at           TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season_id, player_id),
  KEY idx_sas_player (player_id),
  CONSTRAINT fk_sas_season FOREIGN KEY (season_id) REFERENCES league_seasons (id) ON DELETE CASCADE,
  CONSTRAINT fk_sas_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Give every tournament a season.
INSERT IGNORE INTO league_seasons (league_id, season_year)
SELECT DISTINCT t.league_id, YEAR(t.date)
FROM tournament t
WHERE t.season_id IS NULL AND t.date IS NOT NULL;

UPDATE tournament t
JOIN league_seasons ls ON ls.league_id = t.league_id AND ls.season_year = YEAR(t.date)
SET t.season_id = ls.id
WHERE t.season_id IS NULL;

-- Totals per league, season and player. Casts match league_player_totals.
CREATE OR REPLACE VIEW league_player_season_totals AS
SELECT
  lp.league_id,
  ls.id         AS season_id,
  ls.season_year,
  lp.player_id,
  CAST(COALESCE(pts.fedex_points, 0) AS SIGNED)        AS fedex_points,
  CAST(COALESCE(pts.tournaments_played, 0) AS SIGNED)  AS tournaments_played,
  CAST(COALESCE(pay.prize_quota, 0) AS DECIMAL(10,2))      AS prize_quota,
  CAST(COALESCE(pay.prize_skins, 0) AS DECIMAL(10,2))      AS prize_skins,
  CAST(COALESCE(pay.prize_ctp, 0) AS DECIMAL(10,2))        AS prize_ctp,
  CAST(COALESCE(pay.prize_side_games, 0) AS DECIMAL(10,2)) AS prize_side_games,
  CAST(COALESCE(pay.prize_money, 0) AS DECIMAL(10,2))      AS prize_money
FROM league_players lp
JOIN league_seasons ls ON ls.league_id = lp.league_id
LEFT JOIN (
  SELECT t.season_id, tpp.player_id,
         SUM(tpp.points_awarded) AS fedex_points,
         COUNT(*)                AS tournaments_played
  FROM tournament_paradise_points tpp
  JOIN tournament t ON t.id = tpp.tournament_id
  GROUP BY t.season_id, tpp.player_id
) pts ON pts.season_id = ls.id AND pts.player_id = lp.player_id
LEFT JOIN (
  SELECT t.season_id, po.player_id,
         SUM(CASE WHEN po.category = 'quota' THEN po.amount ELSE 0 END)      AS prize_quota,
         SUM(CASE WHEN po.category = 'skins' THEN po.amount ELSE 0 END)      AS prize_skins,
         SUM(CASE WHEN po.category = 'ctp' THEN po.amount ELSE 0 END)        AS prize_ctp,
         SUM(CASE WHEN po.category = 'side_games' THEN po.amount ELSE 0 END) AS prize_side_games,
         SUM(po.amount)                                                     AS prize_money
  FROM tournament_payouts po
  JOIN tournament t ON t.id = po.tournament_id
  GROUP BY t.season_id, po.player_id
) pay ON pay.season_id = ls.id AND pay.player_id = lp.player_id;
