-- ============================================================================
-- Migration: Add Billing Entity Hierarchy
-- Date: 2026-05-02
-- Description: Introduces billing entities as top-level organization
--              Replaces the previous multi-league design with billing hierarchy
-- ============================================================================

-- ============================================================================
-- BILLING ENTITY - Top Level (owns subscription, members, courses)
-- ============================================================================

-- Billing entities: Top-level organization (golf course, league org, event company)
CREATE TABLE IF NOT EXISTS billing_entities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  entity_type ENUM('golf_course', 'league_organization', 'event_company', 'other') NOT NULL DEFAULT 'league_organization',
  description TEXT,
  logo_url VARCHAR(500),
  website VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
  
  -- Billing information
  billing_email VARCHAR(191),
  billing_name VARCHAR(191),
  billing_address TEXT,
  stripe_customer_id VARCHAR(255) UNIQUE,
  
  -- Status
  active TINYINT(1) NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_slug (slug),
  INDEX idx_entity_type (entity_type),
  INDEX idx_active (active),
  INDEX idx_stripe_customer (stripe_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Players now belong to billing entities
ALTER TABLE players
  ADD COLUMN billing_entity_id INT UNSIGNED DEFAULT NULL AFTER id,
  ADD FOREIGN KEY fk_players_billing_entity (billing_entity_id) REFERENCES billing_entities(id) ON DELETE RESTRICT,
  ADD INDEX idx_billing_entity_id (billing_entity_id);

-- Billing entity roles: Defines member roles within billing entity
CREATE TABLE IF NOT EXISTS billing_entity_roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  billing_entity_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entity_player (billing_entity_id, player_id),
  INDEX idx_billing_entity_id (billing_entity_id),
  INDEX idx_player_id (player_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- COURSES - Global with ownership
-- ============================================================================

-- Courses are global but can be owned/managed by billing entities
ALTER TABLE course
  ADD COLUMN created_by_entity_id INT UNSIGNED DEFAULT NULL AFTER id,
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=anyone can use, 0=only creating entity',
  ADD FOREIGN KEY fk_course_entity (created_by_entity_id) REFERENCES billing_entities(id) ON DELETE SET NULL,
  ADD INDEX idx_created_by_entity (created_by_entity_id),
  ADD INDEX idx_is_public (is_public);

-- ============================================================================
-- LEAGUES - Under Billing Entity
-- ============================================================================

-- Leagues: Ongoing competitive groups with seasons, quota tracking
CREATE TABLE IF NOT EXISTS leagues (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  billing_entity_id INT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT,
  season_year INT UNSIGNED,
  start_date DATE,
  end_date DATE,
  active TINYINT(1) NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entity_slug (billing_entity_id, slug),
  INDEX idx_billing_entity_id (billing_entity_id),
  INDEX idx_season_year (season_year),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- League players: Players participating in a specific league
CREATE TABLE IF NOT EXISTS league_players (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league_player (league_id, player_id),
  INDEX idx_league_id (league_id),
  INDEX idx_player_id (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- League player stats: Per-league statistics
CREATE TABLE IF NOT EXISTS league_player_stats (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  
  -- Quota values
  quota_18 INT DEFAULT NULL,
  quota_9 INT DEFAULT NULL,
  
  -- Season stats
  fedex_points INT DEFAULT 0,
  tournaments_played INT DEFAULT 0,
  prize_money DECIMAL(10,2) DEFAULT 0.00,
  
  -- Rankings
  current_rank INT UNSIGNED DEFAULT NULL,
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league_player_stats (league_id, player_id),
  INDEX idx_league_id (league_id),
  INDEX idx_player_id (player_id),
  INDEX idx_fedex_points (fedex_points DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add league_id to quota tracking tables
ALTER TABLE quota
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id,
  ADD FOREIGN KEY fk_quota_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

ALTER TABLE skins_quota
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id,
  ADD FOREIGN KEY fk_skins_quota_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id);

-- ============================================================================
-- EVENTS - Under Billing Entity (separate from leagues)
-- ============================================================================

-- Events: One-off tournaments without season/quota tracking
CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  billing_entity_id INT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  registration_deadline DATE,
  max_participants INT UNSIGNED DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entity_slug (billing_entity_id, slug),
  INDEX idx_billing_entity_id (billing_entity_id),
  INDEX idx_event_date (event_date),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event participants: Players registered for an event
CREATE TABLE IF NOT EXISTS event_participants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid TINYINT(1) NOT NULL DEFAULT 0,
  
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE KEY unique_event_player (event_id, player_id),
  INDEX idx_event_id (event_id),
  INDEX idx_player_id (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TOURNAMENTS - Can belong to League OR Event
-- ============================================================================

ALTER TABLE tournament
  ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER id,
  ADD COLUMN event_id INT UNSIGNED DEFAULT NULL AFTER league_id,
  ADD FOREIGN KEY fk_tournament_league (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  ADD FOREIGN KEY fk_tournament_event (event_id) REFERENCES events(id) ON DELETE CASCADE,
  ADD INDEX idx_league_id (league_id),
  ADD INDEX idx_event_id (event_id),
  ADD CONSTRAINT chk_tournament_parent CHECK (
    (league_id IS NOT NULL AND event_id IS NULL) OR 
    (league_id IS NULL AND event_id IS NOT NULL)
  );

-- ============================================================================
-- SETTINGS - Three Tiers
-- ============================================================================

-- Global settings: System-wide defaults
CREATE TABLE IF NOT EXISTS global_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing entity settings: Per-entity configuration
CREATE TABLE IF NOT EXISTS billing_entity_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  billing_entity_id INT UNSIGNED NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  
  FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entity_setting (billing_entity_id, setting_key),
  INDEX idx_billing_entity_id (billing_entity_id),
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- League settings: Per-league configuration (rename existing settings table)
RENAME TABLE settings TO league_settings_old;

CREATE TABLE IF NOT EXISTS league_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  league_id INT UNSIGNED NOT NULL,
  
  -- Tournament fees
  tournament_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  tournament_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  skins_ctp_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  skins_ctp_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  
  -- Communication
  golf_course_email VARCHAR(255) DEFAULT NULL,
  
  -- Other settings as JSON for flexibility
  additional_settings JSON DEFAULT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
  UNIQUE KEY unique_league (league_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DATA MIGRATION - Create default billing entity and league
-- ============================================================================

-- Create default billing entity for existing data
INSERT INTO billing_entities (name, slug, entity_type, description, active)
VALUES ('Paradise Golf', 'paradise-golf', 'league_organization', 'Original Paradise Golf league organization', 1);

SET @default_entity_id = LAST_INSERT_ID();

-- Create default league under this entity
INSERT INTO leagues (billing_entity_id, name, slug, description, season_year, active)
VALUES (@default_entity_id, 'Paradise Golf League', 'paradise-golf-league', 'Main competitive league', YEAR(CURDATE()), 1);

SET @default_league_id = LAST_INSERT_ID();

-- Assign all existing players to default billing entity
UPDATE players SET billing_entity_id = @default_entity_id;

-- Make billing_entity_id NOT NULL after backfill
ALTER TABLE players MODIFY COLUMN billing_entity_id INT UNSIGNED NOT NULL;

-- Create billing entity roles for all players
INSERT INTO billing_entity_roles (billing_entity_id, player_id, role)
SELECT 
  @default_entity_id,
  id,
  CASE 
    WHEN role = 'admin' THEN 'admin'
    ELSE 'member'
  END
FROM players;

-- Add all players to default league
INSERT INTO league_players (league_id, player_id)
SELECT @default_league_id, id FROM players WHERE active = 1;

-- Migrate player stats to league_player_stats
INSERT INTO league_player_stats (league_id, player_id, quota_18, quota_9, fedex_points, tournaments_played, prize_money)
SELECT 
  @default_league_id,
  id,
  quota_18,
  quota_9,
  fedex_points,
  tournaments_played,
  prize_money
FROM players;

-- Update all existing tournaments to belong to default league
UPDATE tournament SET league_id = @default_league_id;

-- Make league_id NOT NULL for tournaments after backfill
ALTER TABLE tournament MODIFY COLUMN league_id INT UNSIGNED NOT NULL;

-- Update quota tables to default league
UPDATE quota SET league_id = @default_league_id;
UPDATE skins_quota SET league_id = @default_league_id;

-- Make league_id NOT NULL after backfill
ALTER TABLE quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL;
ALTER TABLE skins_quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL;

-- Migrate settings to league settings
INSERT INTO league_settings (league_id, tournament_fee_18_holes, tournament_fee_9_holes, skins_ctp_fee_18_holes, skins_ctp_fee_9_holes, golf_course_email)
SELECT 
  @default_league_id,
  tournament_fee_18_holes,
  tournament_fee_9_holes,
  skins_ctp_fee_18_holes,
  skins_ctp_fee_9_holes,
  golf_course_email
FROM league_settings_old
LIMIT 1;

-- Insert default global settings
INSERT INTO global_settings (setting_key, setting_value, description, data_type) VALUES
('default_tournament_fee_18', '20.00', 'Default tournament fee for 18-hole events', 'number'),
('default_tournament_fee_9', '10.00', 'Default tournament fee for 9-hole events', 'number'),
('default_skins_fee_18', '10.00', 'Default skins/CTP fee for 18-hole events', 'number'),
('default_skins_fee_9', '5.00', 'Default skins/CTP fee for 9-hole events', 'number'),
('system_timezone', 'America/Los_Angeles', 'System default timezone', 'string'),
('max_players_per_tournament', '100', 'Maximum players per tournament', 'number');

-- Update courses to be owned by default entity (optional - or leave NULL for public courses)
-- UPDATE course SET created_by_entity_id = @default_entity_id, is_public = 1;
