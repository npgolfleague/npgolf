-- ============================================================================
-- Migration 066: Playoff prize money
-- Date: 2026-11-24
--
--   * season_playoff_prizes: championship and losers-bracket prizes per season.
--     Kept apart from tournament_payouts because those rows are rebuilt from
--     tournament fees, which would erase prizes paid from the season pots.
--   * league_player_season_totals gains prize_playoffs, included in prize_money.
--   * season_archive_standings gains prize_playoffs.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS season_playoff_prizes (
  season_id    INT UNSIGNED NOT NULL,
  player_id    INT UNSIGNED NOT NULL,
  bracket_type ENUM('playoff', 'losers') NOT NULL,
  place        TINYINT UNSIGNED NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season_id, player_id, bracket_type),
  KEY idx_spp_player (player_id),
  CONSTRAINT fk_spp_season FOREIGN KEY (season_id) REFERENCES league_seasons (id) ON DELETE CASCADE,
  CONSTRAINT fk_spp_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE season_archive_standings ADD COLUMN prize_playoffs DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER prize_side_games',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'season_archive_standings' AND COLUMN_NAME = 'prize_playoffs');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

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
  CAST(COALESCE(po2.prize_playoffs, 0) AS DECIMAL(10,2))   AS prize_playoffs,
  CAST(COALESCE(pay.prize_money, 0) + COALESCE(po2.prize_playoffs, 0) AS DECIMAL(10,2)) AS prize_money
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
) pay ON pay.season_id = ls.id AND pay.player_id = lp.player_id
LEFT JOIN (
  SELECT season_id, player_id, SUM(amount) AS prize_playoffs
  FROM season_playoff_prizes
  GROUP BY season_id, player_id
) po2 ON po2.season_id = ls.id AND po2.player_id = lp.player_id;
