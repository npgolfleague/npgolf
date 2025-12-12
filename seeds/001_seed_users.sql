USE npgolf;

-- Password for all seed players is: Password123
-- Hashed with bcrypt (10 rounds)
INSERT INTO players (name, email, sex, active, password) VALUES
('Seed User', 'seed@example.com', 'M', 1, '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC'),
('Test User', 'test@example.com', 'F', 1, '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC')
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  sex = VALUES(sex),
  active = VALUES(active),
  password = VALUES(password);
