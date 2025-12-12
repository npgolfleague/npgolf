-- Migration: Add role column to players table
-- Date: 2025-12-09

ALTER TABLE players ADD COLUMN role VARCHAR(20) DEFAULT 'player' AFTER password;

-- Valid roles: 'player', 'admin'
