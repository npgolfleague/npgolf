-- Create tournament_players junction table to manage which players are registered for each tournament
CREATE TABLE IF NOT EXISTS tournament_players (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tournament_player (tournament_id, player_id),
  INDEX idx_tournament_id (tournament_id),
  INDEX idx_player_id (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
