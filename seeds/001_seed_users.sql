USE npgolf;

INSERT INTO users (name, email) VALUES
('Seed User', 'seed@example.com')
ON DUPLICATE KEY UPDATE email = VALUES(email);
