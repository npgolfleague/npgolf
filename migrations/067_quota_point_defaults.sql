-- ============================================================================
-- Migration 067: Quota point defaults
-- Date: 2026-11-24
--
--   New leagues start with 8 / 6 / 4 / 2 / 1 / 0 / 0 (albatross or ace, eagle,
--   birdie, par, bogey, double bogey, worse), as used for score entry. Existing
--   leagues' settings aren't changed. Idempotent.
-- ============================================================================

ALTER TABLE league_settings
  ALTER COLUMN quota_points_albatross SET DEFAULT 8,
  ALTER COLUMN quota_points_eagle SET DEFAULT 6,
  ALTER COLUMN quota_points_birdie SET DEFAULT 4,
  ALTER COLUMN quota_points_par SET DEFAULT 2,
  ALTER COLUMN quota_points_bogey SET DEFAULT 1,
  ALTER COLUMN quota_points_double_bogey SET DEFAULT 0,
  ALTER COLUMN quota_points_worse SET DEFAULT 0;
