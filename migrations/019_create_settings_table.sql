CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tournament_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 20.00 COMMENT 'Tournament fee for 18 hole events',
  tournament_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Tournament fee for 9 hole events',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='Application settings';

-- Insert default settings
INSERT INTO settings (tournament_fee_18_holes, tournament_fee_9_holes) 
VALUES (20.00, 10.00);
