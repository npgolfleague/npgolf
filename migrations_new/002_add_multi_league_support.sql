-- Migration: Add multi-league support
-- This migration adds tables and columns to support multiple independent leagues

-- Leagues table: Each league is a separate instance/organization
CREATE TABLE IF NOT EXISTS leagues (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  owner_id INT UNSIGNED NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES players(id) ON DELETE RESTRICT,
  INDEX idx_slug (slug),
  INDEX idx_owner_id (owner_id),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- League memberships: Many-to-many relationship between players and leagues
CREATE TABLE IF NOT EXISTS league_memberships (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league_player (league_id, player_id),
  INDEX idx_league_id (league_id),
  INDEX idx_player_id (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add league_id to existing tables
ALTER TABLE tournament 
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER id,
  ADD FOREIGN KEY fk_tournament_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

ALTER TABLE course
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER id,
  ADD FOREIGN KEY fk_course_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

ALTER TABLE quota
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id,
  ADD FOREIGN KEY fk_quota_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

ALTER TABLE skins_quota
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id,
  ADD FOREIGN KEY fk_skins_quota_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

-- NOTE: You may want to add league_id to other tables like:
-- - emails (if emails are league-specific)
-- - settings (if each league has its own settings)

-- Create default league for existing data
INSERT INTO leagues (name, slug, owner_id, description)
SELECT 
  'Paradise Golf' as name,
  'paradise-golf' as slug,
  (SELECT id FROM players WHERE role = 'admin' ORDER BY id LIMIT 1) as owner_id,
  'Original Paradise Golf league' as description;

-- Associate all existing players with the default league
INSERT INTO league_memberships (league_id, player_id, role)
SELECT 
  (SELECT id FROM leagues WHERE slug = 'paradise-golf') as league_id,
  id as player_id,
  CASE 
    WHEN role = 'admin' THEN 'admin'
    ELSE 'member'
  END as role
FROM players;

-- Update existing records to belong to default league
UPDATE tournament SET league_id = (SELECT id FROM leagues WHERE slug = 'paradise-golf');
UPDATE course SET league_id = (SELECT id FROM leagues WHERE slug = 'paradise-golf');
UPDATE quota SET league_id = (SELECT id FROM leagues WHERE slug = 'paradise-golf');
UPDATE skins_quota SET league_id = (SELECT id FROM leagues WHERE slug = 'paradise-golf');

-- Make league_id NOT NULL after backfilling
ALTER TABLE tournament MODIFY COLUMN league_id INT UNSIGNED NOT NULL;
ALTER TABLE course MODIFY COLUMN league_id INT UNSIGNED NOT NULL;
ALTER TABLE quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL;
ALTER TABLE skins_quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL;
