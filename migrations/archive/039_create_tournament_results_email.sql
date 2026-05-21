-- Create table to store generated tournament results emails
CREATE TABLE IF NOT EXISTS tournament_results_email (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tournament_id INT NOT NULL,
  subject VARCHAR(500),
  html MEDIUMTEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  UNIQUE KEY uq_tournament (tournament_id),
  INDEX idx_tournament_id (tournament_id)
);
