-- ============================================================================
-- Migration 070: Individual Nassau match play
-- Date: 2026-11-25
--
-- A private bet between two players in an 18-hole round, who may be in different
-- foursomes: front 9, back 9 and overall. player_a proposes the terms and
-- player_b accepts or declines. Results are worked out from scores when read
-- (src/utils/matchPlay.js); nothing here feeds prize totals.
--
-- Only adds a table. Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS nassau_matches (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id  INT UNSIGNED NOT NULL,
  player_a       INT UNSIGNED NOT NULL,
  player_b       INT UNSIGNED NOT NULL,
  -- The same two players can have one match per round, whoever proposed it
  pair_low       INT UNSIGNED NOT NULL,
  pair_high      INT UNSIGNED NOT NULL,
  amount_front   DECIMAL(8,2) NOT NULL DEFAULT 0,
  amount_back    DECIMAL(8,2) NOT NULL DEFAULT 0,
  amount_overall DECIMAL(8,2) NOT NULL DEFAULT 0,
  use_handicaps  TINYINT(1) NOT NULL DEFAULT 0,
  handicap_a     SMALLINT DEFAULT NULL,
  handicap_b     SMALLINT DEFAULT NULL,
  auto_press     TINYINT(1) NOT NULL DEFAULT 0,
  carry_halved   TINYINT(1) NOT NULL DEFAULT 0,
  status         ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at    TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nassau_pair (tournament_id, pair_low, pair_high),
  KEY idx_nassau_a (player_a),
  KEY idx_nassau_b (player_b),
  CONSTRAINT fk_nassau_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE,
  CONSTRAINT fk_nassau_a FOREIGN KEY (player_a) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_nassau_b FOREIGN KEY (player_b) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
