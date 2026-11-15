-- ============================================================================
-- Migration 061: FedEx points and prize money are per league
-- Date: 2026-11-14
--
--   * tournament_payouts: what each player won in each tournament, split into
--     quota / skins / ctp. Written by the app (src/payouts.js) from that
--     tournament's own league fees, every time results can change.
--   * league_player_totals (view): per league and player, the FedEx points and
--     tournaments played (from tournament_paradise_points) and prize money
--     (from tournament_payouts). Totals are always calculated from the
--     per-tournament results, so they can't drift or mix leagues.
--
-- players.fedex_points / tournaments_played / prize_money are no longer read or
-- written by the app; a later migration drops them.
--
-- The payouts table starts empty: the app fills it the first time a league's
-- player list is loaded (and on every tournament completion or restore).
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_payouts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NOT NULL,
  category      ENUM('quota', 'skins', 'ctp') NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payout (tournament_id, player_id, category),
  KEY idx_payout_player (player_id),
  CONSTRAINT fk_payout_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Casts keep the column types the API returned before (integers for points
-- and counts, DECIMAL(10,2) for money).
CREATE OR REPLACE VIEW league_player_totals AS
SELECT
  lp.league_id,
  lp.player_id,
  CAST(COALESCE(pts.fedex_points, 0) AS SIGNED)        AS fedex_points,
  CAST(COALESCE(pts.tournaments_played, 0) AS SIGNED)  AS tournaments_played,
  CAST(COALESCE(pay.prize_money, 0) AS DECIMAL(10,2))  AS prize_money
FROM league_players lp
LEFT JOIN (
  SELECT t.league_id, tpp.player_id,
         SUM(tpp.points_awarded) AS fedex_points,
         COUNT(*)                AS tournaments_played
  FROM tournament_paradise_points tpp
  JOIN tournament t ON t.id = tpp.tournament_id
  GROUP BY t.league_id, tpp.player_id
) pts ON pts.league_id = lp.league_id AND pts.player_id = lp.player_id
LEFT JOIN (
  SELECT t.league_id, po.player_id,
         SUM(po.amount) AS prize_money
  FROM tournament_payouts po
  JOIN tournament t ON t.id = po.tournament_id
  GROUP BY t.league_id, po.player_id
) pay ON pay.league_id = lp.league_id AND pay.player_id = lp.player_id;
