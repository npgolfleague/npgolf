-- 004_rename_users_to_players.sql
USE npgolf;

-- Rename users table to players
RENAME TABLE users TO players;

-- Add sex column (M/F/Other)
ALTER TABLE players ADD COLUMN sex CHAR(1) DEFAULT NULL AFTER email;

-- Add active flag (1=active, 0=inactive)
ALTER TABLE players ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER sex;
