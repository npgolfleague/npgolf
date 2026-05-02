-- Add email column to players table
ALTER TABLE players ADD COLUMN email VARCHAR(255);

-- Add index for email lookups
CREATE INDEX idx_players_email ON players(email);
