-- Add attending status tracking to tournament_players table
ALTER TABLE tournament_players ADD COLUMN attending_status ENUM('pending', 'yes', 'no') DEFAULT 'pending';
ALTER TABLE tournament_players ADD COLUMN response_date TIMESTAMP NULL DEFAULT NULL;
