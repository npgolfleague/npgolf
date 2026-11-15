-- ============================================================================
-- Migration 062: Millisecond timestamps on scores.entered_at
-- Date: 2026-11-14
--
-- A saved hole locks for non-admins once that player has a later hole saved
-- (src/routes/scores.js). "Later" is decided by entered_at, so two holes saved
-- within the same second must still be told apart.
--
-- Idempotent: safe to re-run.
-- ============================================================================

SET @s = (SELECT IF(DATETIME_PRECISION = 3, 'SELECT 1',
  'ALTER TABLE scores MODIFY COLUMN entered_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3)')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scores' AND COLUMN_NAME = 'entered_at');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
