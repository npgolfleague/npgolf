-- Create league rulesets table to support league-specific local rules and versioned publishing

CREATE TABLE IF NOT EXISTS league_rulesets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  content_json LONGTEXT NOT NULL,
  effective_from DATE DEFAULT NULL,
  effective_to DATE DEFAULT NULL,
  created_by INT UNSIGNED DEFAULT NULL,
  published_by INT UNSIGNED DEFAULT NULL,
  published_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rulesets_league FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  CONSTRAINT fk_rulesets_created_by FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_rulesets_published_by FOREIGN KEY (published_by) REFERENCES players(id) ON DELETE SET NULL,
  INDEX idx_rulesets_league (league_id),
  INDEX idx_rulesets_status (status),
  INDEX idx_rulesets_effective (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed one published local-rules ruleset per league if none exists yet
INSERT INTO league_rulesets (
  league_id,
  title,
  status,
  content_json,
  effective_from,
  published_at
)
SELECT
  l.id,
  'Default Local Rules',
  'published',
  '{"localRules":["Mulligan on first hole played. If your first shot is not a good one you may without penalty play a second shot, with the caveat that you must play the second shot (you don''t choose the best one).","Out of Bounds. Balls hit OB can be played as one stoke penalty with no distance penalty. The ball can NOT be played from OB but the ball may be dropped as it would if the penalty area was marked with red stakes. Either two club lengths from where the ball entered the penalty area; or as far back as desired on a line from the hole to the where the ball crossed into the penalty area.","Gimme''s there are no gimme''s during the championship. During regular season anything within 12 inches can be given. Gimme''s must be given by a playing partner (you can''t give yourself a putt)."]}',
  CURDATE(),
  NOW()
FROM leagues l
WHERE NOT EXISTS (
  SELECT 1
  FROM league_rulesets r
  WHERE r.league_id = l.id AND r.status = 'published'
);
