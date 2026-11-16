-- ============================================================================
-- Migration 064: Optional side games
-- Date: 2026-11-15
--
-- Side games are optional bets worked out at completion from the scores every
-- player already enters (each player plays their own ball), so the quota game,
-- skins and CTP are unchanged. Games:
--   blind_draw    random partners drawn after the round, best combined +/- quota
--   quota_nassau  front / back / overall (9 holes: 1-3, 4-6, 7-9 + overall)
--                 against a prorated quota
--   birdie_pot    pot split per gross birdie (eagle or better = 2 shares)
--
--   * league_side_game_defaults: per league, which games are on by default and
--     their 9- and 18-hole fees. Copied onto each new tournament.
--   * tournament_side_games: a row means that game is on for that tournament.
--     collected overrides "paid entrants x fee", like tournament.skins_collected.
--   * tournament_side_game_entries: who paid into which game.
--   * tournament_side_game_teams: the saved Blind Draw.
--   * tournament_side_game_results: per game and segment, each entrant's score
--     and prize money. Written by the app (src/sideGames.js) on completion.
--   * tournament_payouts.category gains 'side_games'. The league_player_totals
--     view sums every category, so prize totals include it with no change.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS league_side_game_defaults (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  league_id  INT UNSIGNED NOT NULL,
  game_type  ENUM('blind_draw', 'quota_nassau', 'birdie_pot') NOT NULL,
  enabled    TINYINT(1) NOT NULL DEFAULT 0,
  fee_9      DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  fee_18     DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_league_side_game (league_id, game_type),
  CONSTRAINT fk_lsgd_league FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tournament_side_games (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  game_type     ENUM('blind_draw', 'quota_nassau', 'birdie_pot') NOT NULL,
  fee           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  collected     DECIMAL(10,2) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_side_game (tournament_id, game_type),
  CONSTRAINT fk_tsg_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tournament_side_game_entries (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  game_type     ENUM('blind_draw', 'quota_nassau', 'birdie_pot') NOT NULL,
  player_id     INT UNSIGNED NOT NULL,
  paid          TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_side_game_entry (tournament_id, game_type, player_id),
  KEY idx_sge_player (player_id),
  CONSTRAINT fk_sge_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_sge_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tournament_side_game_teams (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  team_no       SMALLINT UNSIGNED NOT NULL,
  player_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_side_game_team_player (tournament_id, player_id),
  KEY idx_sgt_player (player_id),
  CONSTRAINT fk_sgt_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_sgt_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tournament_side_game_results (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  game_type     ENUM('blind_draw', 'quota_nassau', 'birdie_pot') NOT NULL,
  segment       VARCHAR(20) NOT NULL DEFAULT 'overall',
  player_id     INT UNSIGNED NOT NULL,
  team_no       SMALLINT UNSIGNED NULL DEFAULT NULL,
  score         DECIMAL(8,2) NULL DEFAULT NULL,
  shares        SMALLINT UNSIGNED NULL DEFAULT NULL,
  is_winner     TINYINT(1) NOT NULL DEFAULT 0,
  prize_money   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_side_game_result (tournament_id, game_type, segment, player_id),
  KEY idx_sgr_player (player_id),
  CONSTRAINT fk_sgr_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_sgr_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @s = (SELECT IF(COLUMN_TYPE LIKE '%side_games%',
  'SELECT 1',
  "ALTER TABLE tournament_payouts MODIFY category ENUM('quota', 'skins', 'ctp', 'side_games') NOT NULL")
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament_payouts' AND COLUMN_NAME = 'category');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
