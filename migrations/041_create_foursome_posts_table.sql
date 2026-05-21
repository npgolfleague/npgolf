CREATE TABLE IF NOT EXISTS foursome_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT UNSIGNED NOT NULL,
  foursome_group VARCHAR(100) NOT NULL,
  posted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  posted_by INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_tournament_foursome (tournament_id, foursome_group),
  CONSTRAINT fk_fp_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
  CONSTRAINT fk_fp_player FOREIGN KEY (posted_by) REFERENCES players(id)
);
