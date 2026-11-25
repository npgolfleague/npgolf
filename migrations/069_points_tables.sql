-- ============================================================================
-- Migration 069: Cup points tables per league
-- Date: 2026-11-24
--
-- JSON object of points by place: weekly, seed, semifinal, final, losers.
-- NULL (every league today) means the standard values in
-- src/utils/pointsTables.js, so no points change. Saved results are not touched.
--
-- Idempotent: safe to re-run.
-- ============================================================================

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_settings ADD COLUMN points_tables JSON DEFAULT NULL',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'league_settings' AND COLUMN_NAME = 'points_tables');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
