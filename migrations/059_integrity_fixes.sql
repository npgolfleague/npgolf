-- ============================================================================
-- Migration 059: Integrity fixes
-- Date: 2026-11-14
--
--  1. One collation for every table (utf8mb4_0900_ai_ci, the database default),
--     so string joins such as tournament_players.foursome = scores.foursome_group
--     can't fail with "Illegal mix of collations".
--  2. Deleting a league no longer silently cascades into its tournaments and scores
--     (tournament.league_id FK -> RESTRICT; the API already refuses that delete).
--  3. league_seasons champion / tiebreak / losers-winner columns get FKs.
--  4. foursome_posts.posted_by: deleting a player no longer fails; the post stays
--     with posted_by = NULL.
--  5. tournament_results_email.tournament_id becomes INT UNSIGNED with an FK.
--  6. emails.message_id is UNIQUE (it is the dedupe key).
--  7. Drops indexes that duplicate the left edge of another index, or that index
--     a low-selectivity boolean flag.
--
-- Run after 058. Idempotent: safe to re-run if it fails partway.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Collation
-- ---------------------------------------------------------------------------
ALTER TABLE billing_entities     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE billing_entity_roles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE course_tee           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE hole_tee             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE league_player_stats  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE league_players       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE league_rulesets      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE league_settings      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE leagues              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE tournament_players   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE schema_migrations    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. tournament.league_id: CASCADE -> RESTRICT
-- ---------------------------------------------------------------------------
SET @fk = (SELECT rc.CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.TABLE_NAME = 'tournament'
    AND rc.REFERENCED_TABLE_NAME = 'leagues' AND rc.DELETE_RULE NOT IN ('RESTRICT', 'NO ACTION')
  LIMIT 1);
SET @s = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE tournament DROP FOREIGN KEY `', @fk, '`'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE tournament ADD CONSTRAINT fk_tournament_league FOREIGN KEY (league_id) REFERENCES leagues (id) ON DELETE RESTRICT',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament' AND REFERENCED_TABLE_NAME = 'leagues');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 3. league_seasons player references (clear any dangling ids first)
-- ---------------------------------------------------------------------------
UPDATE league_seasons SET champion_player_id = NULL
  WHERE champion_player_id IS NOT NULL AND champion_player_id NOT IN (SELECT id FROM players);
UPDATE league_seasons SET champion_tiebreak_player_id = NULL
  WHERE champion_tiebreak_player_id IS NOT NULL AND champion_tiebreak_player_id NOT IN (SELECT id FROM players);
UPDATE league_seasons SET losers_winner_player_id = NULL
  WHERE losers_winner_player_id IS NOT NULL AND losers_winner_player_id NOT IN (SELECT id FROM players);

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_seasons ADD CONSTRAINT fk_ls_champion FOREIGN KEY (champion_player_id) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'league_seasons' AND CONSTRAINT_NAME = 'fk_ls_champion');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_seasons ADD CONSTRAINT fk_ls_champion_tiebreak FOREIGN KEY (champion_tiebreak_player_id) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'league_seasons' AND CONSTRAINT_NAME = 'fk_ls_champion_tiebreak');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_seasons ADD CONSTRAINT fk_ls_losers_winner FOREIGN KEY (losers_winner_player_id) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'league_seasons' AND CONSTRAINT_NAME = 'fk_ls_losers_winner');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 4. foursome_posts.posted_by: nullable, ON DELETE SET NULL
-- ---------------------------------------------------------------------------
SET @fk = (SELECT rc.CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS rc
  WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.TABLE_NAME = 'foursome_posts'
    AND rc.REFERENCED_TABLE_NAME = 'players' AND rc.DELETE_RULE <> 'SET NULL'
  LIMIT 1);
SET @s = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE foursome_posts DROP FOREIGN KEY `', @fk, '`'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

ALTER TABLE foursome_posts MODIFY COLUMN posted_by INT UNSIGNED NULL;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foursome_posts ADD CONSTRAINT fk_fp_player FOREIGN KEY (posted_by) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'foursome_posts' AND REFERENCED_TABLE_NAME = 'players');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 5. tournament_results_email: unsigned ids + FK
-- ---------------------------------------------------------------------------
DELETE r FROM tournament_results_email r
  LEFT JOIN tournament t ON t.id = r.tournament_id
  WHERE t.id IS NULL;

ALTER TABLE tournament_results_email
  MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN tournament_id INT UNSIGNED NOT NULL;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE tournament_results_email ADD CONSTRAINT fk_tre_tournament FOREIGN KEY (tournament_id) REFERENCES tournament (id) ON DELETE CASCADE',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament_results_email' AND REFERENCED_TABLE_NAME = 'tournament');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 6. emails.message_id UNIQUE (keep the newest row if duplicates exist)
-- ---------------------------------------------------------------------------
DELETE e1 FROM emails e1
  JOIN emails e2 ON e2.message_id = e1.message_id AND e2.id > e1.id
  WHERE e1.message_id IS NOT NULL;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE emails ADD UNIQUE KEY uq_message_id (message_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'uq_message_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 7. Redundant / low-value indexes
--    Each one is covered by a UNIQUE or composite index that starts with the
--    same column, so foreign keys keep a usable index.
-- ---------------------------------------------------------------------------
-- One block per index (plain SQL has no loops outside stored procedures).
SET @t = 'emails';                   SET @i = 'idx_message_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'emails';                   SET @i = 'idx_is_read';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'tournament_results_email'; SET @i = 'idx_tournament_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'tournament_players';       SET @i = 'idx_tournament_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'scores';                   SET @i = 'idx_tournament_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'league_players';           SET @i = 'idx_league_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'league_player_stats';      SET @i = 'idx_league_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'billing_entity_roles';     SET @i = 'idx_billing_entity_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'course_tee';               SET @i = 'idx_course_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'hole_tee';                 SET @i = 'idx_hole_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'league_seasons';           SET @i = 'idx_league_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'season_player_stats';      SET @i = 'idx_sps_season_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'tournament_playoff_points'; SET @i = 'idx_tpp_tournament_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'billing_entities';         SET @i = 'idx_slug';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'billing_entities';         SET @i = 'idx_stripe_customer';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'billing_entities';         SET @i = 'idx_active';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'leagues';                  SET @i = 'idx_alias';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'leagues';                  SET @i = 'idx_billing_entity_id';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'leagues';                  SET @i = 'idx_active';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'tournament';               SET @i = 'idx_in_progress';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'tournament';               SET @i = 'idx_completed';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @t = 'course';                   SET @i = 'idx_is_public';
SET @s = (SELECT IF(COUNT(*) > 0, CONCAT('ALTER TABLE `', @t, '` DROP INDEX `', @i, '`'), 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t AND INDEX_NAME = @i);
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
