-- Create emails table for receiving and displaying inbound emails
CREATE TABLE IF NOT EXISTS emails (
  id INT PRIMARY KEY AUTO_INCREMENT,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_email VARCHAR(255),
  subject VARCHAR(500),
  text TEXT,
  html MEDIUMTEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  INDEX idx_received_at (received_at DESC),
  INDEX idx_is_read (is_read)
);
