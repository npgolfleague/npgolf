-- ============================================================================
-- Migration 060: Quota is per league
-- Date: 2026-11-14
--
-- Leagues score quota points differently (league_settings.quota_points_*), so a
-- player who plays in two leagues keeps a separate quota in each.
--
--   * Current quota moves from players.quota_18/quota_9 to
--     league_players.quota_18/quota_9 (one row per player per league).
--   * Quota history (quota, skins_quota) gets UNIQUE (player_id, league_id).
--   * Anyone who has recorded scores in a league's tournament becomes a member
--     of that league (being invited and answering "no" doesn't count). Their
--     quota there starts from the quota snapshot saved on their most recent
--     tournament in that league.
--
-- players.quota_18/quota_9 are no longer read or written by the app. They are
-- kept for now as a fallback and will be dropped by a later migration.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-league quota columns on the membership row
-- ---------------------------------------------------------------------------
SET @fresh = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'league_players' AND COLUMN_NAME = 'quota_18');

SET @s = IF(@fresh,
  'ALTER TABLE league_players ADD COLUMN quota_18 INT NULL AFTER player_id, ADD COLUMN quota_9 INT NULL AFTER quota_18',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 2. Existing memberships take the player's current quota (first run only).
--    Today no player belongs to more than one league, so this is exact.
-- ---------------------------------------------------------------------------
SET @s = IF(@fresh,
  'UPDATE league_players lp JOIN players p ON p.id = lp.player_id SET lp.quota_18 = p.quota_18, lp.quota_9 = p.quota_9',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- 3. Players who recorded scores in a league without being a member join it,
--    with the quota snapshot from their latest tournament there.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO league_players (league_id, player_id, quota_18, quota_9)
SELECT
  x.league_id,
  x.player_id,
  (SELECT tp2.tournament_quota
     FROM tournament_players tp2
     JOIN tournament t2 ON t2.id = tp2.tournament_id
    WHERE tp2.player_id = x.player_id AND t2.league_id = x.league_id
      AND t2.number_of_holes = 18 AND tp2.tournament_quota IS NOT NULL
    ORDER BY t2.date DESC, t2.id DESC LIMIT 1),
  (SELECT tp2.tournament_quota
     FROM tournament_players tp2
     JOIN tournament t2 ON t2.id = tp2.tournament_id
    WHERE tp2.player_id = x.player_id AND t2.league_id = x.league_id
      AND t2.number_of_holes = 9 AND tp2.tournament_quota IS NOT NULL
    ORDER BY t2.date DESC, t2.id DESC LIMIT 1)
FROM (
  SELECT DISTINCT t.league_id, s.player_id
  FROM scores s
  JOIN tournament t ON t.id = s.tournament_id
) x;

-- ---------------------------------------------------------------------------
-- 4. One quota history row per player per league
--    (the new UNIQUE index starts with player_id, so it also serves the
--    player FK and the old single-column index can go)
-- ---------------------------------------------------------------------------
SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE quota ADD UNIQUE KEY uq_quota_player_league (player_id, league_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quota' AND INDEX_NAME = 'uq_quota_player_league');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) > 0, 'ALTER TABLE quota DROP INDEX idx_player_id', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quota' AND INDEX_NAME = 'idx_player_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE skins_quota ADD UNIQUE KEY uq_skins_quota_player_league (player_id, league_id)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'skins_quota' AND INDEX_NAME = 'uq_skins_quota_player_league');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) > 0, 'ALTER TABLE skins_quota DROP INDEX idx_player_id', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'skins_quota' AND INDEX_NAME = 'idx_player_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
