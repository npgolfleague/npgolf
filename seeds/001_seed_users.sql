USE npgolf;

-- Password for all seed users is: Password123
-- Hashed with bcrypt (10 rounds)
INSERT INTO users (name, email, password) VALUES
('Seed User', 'seed@example.com', '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC'),
('Test User', 'test@example.com', '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC')
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  password = VALUES(password);
