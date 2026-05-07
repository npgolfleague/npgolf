-- Add quota point values to league_settings so each league can configure them
-- Default values match the current hardcoded values in tournaments.js

ALTER TABLE league_settings
  ADD COLUMN quota_points_albatross INT NOT NULL DEFAULT 8 COMMENT 'Points for albatross (3 under par)',
  ADD COLUMN quota_points_eagle INT NOT NULL DEFAULT 8 COMMENT 'Points for eagle (2 under par)',
  ADD COLUMN quota_points_birdie INT NOT NULL DEFAULT 6 COMMENT 'Points for birdie (1 under par)',
  ADD COLUMN quota_points_par INT NOT NULL DEFAULT 4 COMMENT 'Points for par',
  ADD COLUMN quota_points_bogey INT NOT NULL DEFAULT 2 COMMENT 'Points for bogey (1 over par)',
  ADD COLUMN quota_points_double_bogey INT NOT NULL DEFAULT 1 COMMENT 'Points for double bogey (2 over par)',
  ADD COLUMN quota_points_worse INT NOT NULL DEFAULT 0 COMMENT 'Points for worse than double bogey';
