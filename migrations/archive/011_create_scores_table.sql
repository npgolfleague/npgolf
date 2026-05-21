-- Migration: Create scores table
-- Date: 2025-12-05

CREATE TABLE IF NOT EXISTS scores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tournament_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  hole_id INT UNSIGNED NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  quota DECIMAL(5,2) DEFAULT NULL,
  FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (hole_id) REFERENCES hole(id) ON DELETE CASCADE,
  INDEX idx_tournament_id (tournament_id),
  INDEX idx_player_id (player_id),
  INDEX idx_hole_id (hole_id),
  UNIQUE KEY unique_tournament_player_hole (tournament_id, player_id, hole_id)
);
