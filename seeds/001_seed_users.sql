USE npgolf;

-- Create a default billing entity for the Paradise Golf League
INSERT IGNORE INTO billing_entities (id, name, slug, entity_type, active)
VALUES (1, 'Paradise Golf League', 'paradise', 'league_organization', 1);

-- Password for all seed players is: Password123
-- Hashed with bcrypt (10 rounds)
INSERT INTO players (billing_entity_id, name, email, sex, active, password) VALUES
(1, 'Dalin Dquists', 'dalindquists@gmail.com', 'M', 1, '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC'),
(1, 'Seed User', 'seed@example.com', 'M', 1, '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC'),
(1, 'Test User', 'test@example.com', 'F', 1, '$2a$10$rXkJXLV9ZxqHzEqP4c9mJOEy4KmH3LnH8vP8V4xJ8GvQzE5yZlKqC')
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  sex = VALUES(sex),
  active = VALUES(active),
  password = VALUES(password);
