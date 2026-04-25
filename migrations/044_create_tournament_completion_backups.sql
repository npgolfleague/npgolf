CREATE TABLE IF NOT EXISTS tournament_completion_backups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT UNSIGNED NOT NULL,
  backup_data JSON NOT NULL,
  restored_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tcb_tournament_id (tournament_id),
  FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
);
