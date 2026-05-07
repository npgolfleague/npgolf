ALTER TABLE league_settings
  ADD COLUMN live_scoring TINYINT(1) NOT NULL DEFAULT 1
  COMMENT 'If 1, scores are visible on leaderboard as they are entered. If 0, only visible after foursome posts scores.';
