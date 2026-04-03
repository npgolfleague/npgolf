CREATE TABLE IF NOT EXISTS tournament_paradise_points (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  place INT UNSIGNED NOT NULL,
  total_quota_points INT NOT NULL,
  player_quota INT NOT NULL,
  over_under INT NOT NULL,
  points_awarded INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_tournament_player_points (tournament_id, player_id),
  KEY idx_tpp_player_id (player_id),
  FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
