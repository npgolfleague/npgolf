-- ============================================================================
-- Migration 068: Quota method per league
-- Date: 2026-11-24
--
--   last_7:       average of the last 7 rounds (every league today)
--   best_8_of_20: best 8 of the last 20 rounds (reserved; not built yet, so the
--                 app refuses to save it)
--
-- Idempotent: safe to re-run.
-- ============================================================================

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_settings ADD COLUMN quota_method ENUM(''last_7'', ''best_8_of_20'') NOT NULL DEFAULT ''last_7''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'league_settings' AND COLUMN_NAME = 'quota_method');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
