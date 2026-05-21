-- Expand player role enum to support league-scoped and global admin roles
ALTER TABLE players
  MODIFY COLUMN role ENUM('player','league_admin','admin','super_admin') DEFAULT 'player';
