-- ============================================================================
-- Migration: Add Billing Entity Hierarchy (IDEMPOTENT VERSION)
-- Date: 2026-05-02
-- Description: Introduces billing entities as top-level organization
--              Replaces the previous multi-league design with billing hierarchy
--              This version can be safely re-run if it fails partway through
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

-- Add billing_entity_id to players (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'players' 
    AND COLUMN_NAME = 'billing_entity_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE players ADD COLUMN billing_entity_id INT UNSIGNED DEFAULT NULL AFTER id',
  'SELECT ''Column billing_entity_id already exists in players'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for players.billing_entity_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'players'
    AND CONSTRAINT_NAME = 'fk_players_billing_entity'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE players ADD CONSTRAINT fk_players_billing_entity FOREIGN KEY (billing_entity_id) REFERENCES billing_entities(id) ON DELETE RESTRICT',
  'SELECT ''Foreign key fk_players_billing_entity already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for players.billing_entity_id (idempotent)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'players'
    AND INDEX_NAME = 'idx_billing_entity_id'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE players ADD INDEX idx_billing_entity_id (billing_entity_id)',
  'SELECT ''Index idx_billing_entity_id already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- Add created_by_entity_id to course (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'course' 
    AND COLUMN_NAME = 'created_by_entity_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE course ADD COLUMN created_by_entity_id INT UNSIGNED DEFAULT NULL AFTER id',
  'SELECT ''Column created_by_entity_id already exists in course'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_public to course (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'course' 
    AND COLUMN_NAME = 'is_public'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE course ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=anyone can use, 0=only creating entity'' AFTER created_by_entity_id',
  'SELECT ''Column is_public already exists in course'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for course.created_by_entity_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course'
    AND CONSTRAINT_NAME = 'fk_course_entity'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE course ADD CONSTRAINT fk_course_entity FOREIGN KEY (created_by_entity_id) REFERENCES billing_entities(id) ON DELETE SET NULL',
  'SELECT ''Foreign key fk_course_entity already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes for course (idempotent)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course'
    AND INDEX_NAME = 'idx_created_by_entity'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE course ADD INDEX idx_created_by_entity (created_by_entity_id)',
  'SELECT ''Index idx_created_by_entity already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course'
    AND INDEX_NAME = 'idx_is_public'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE course ADD INDEX idx_is_public (is_public)',
  'SELECT ''Index idx_is_public already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- Add league_id to quota (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'quota' 
    AND COLUMN_NAME = 'league_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE quota ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id',
  'SELECT ''Column league_id already exists in quota'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for quota.league_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quota'
    AND CONSTRAINT_NAME = 'fk_quota_league'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE quota ADD CONSTRAINT fk_quota_league FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE',
  'SELECT ''Foreign key fk_quota_league already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for quota.league_id (idempotent)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quota'
    AND INDEX_NAME = 'idx_league_id'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE quota ADD INDEX idx_league_id (league_id)',
  'SELECT ''Index idx_league_id already exists in quota'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add league_id to skins_quota (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'skins_quota' 
    AND COLUMN_NAME = 'league_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE skins_quota ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER player_id',
  'SELECT ''Column league_id already exists in skins_quota'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for skins_quota.league_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'skins_quota'
    AND CONSTRAINT_NAME = 'fk_skins_quota_league'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE skins_quota ADD CONSTRAINT fk_skins_quota_league FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE',
  'SELECT ''Foreign key fk_skins_quota_league already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for skins_quota.league_id (idempotent)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'skins_quota'
    AND INDEX_NAME = 'idx_league_id'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE skins_quota ADD INDEX idx_league_id (league_id)',
  'SELECT ''Index idx_league_id already exists in skins_quota'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- Add league_id to tournament (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tournament' 
    AND COLUMN_NAME = 'league_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE tournament ADD COLUMN league_id INT UNSIGNED DEFAULT NULL AFTER id',
  'SELECT ''Column league_id already exists in tournament'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add event_id to tournament (idempotent)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'tournament' 
    AND COLUMN_NAME = 'event_id'
);

SET @sql = IF(@column_exists = 0,
  'ALTER TABLE tournament ADD COLUMN event_id INT UNSIGNED DEFAULT NULL AFTER league_id',
  'SELECT ''Column event_id already exists in tournament'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for tournament.league_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND CONSTRAINT_NAME = 'fk_tournament_league'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE tournament ADD CONSTRAINT fk_tournament_league FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE',
  'SELECT ''Foreign key fk_tournament_league already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for tournament.event_id (idempotent)
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND CONSTRAINT_NAME = 'fk_tournament_event'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE tournament ADD CONSTRAINT fk_tournament_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE',
  'SELECT ''Foreign key fk_tournament_event already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes for tournament (idempotent)
SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND INDEX_NAME = 'idx_league_id'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE tournament ADD INDEX idx_league_id (league_id)',
  'SELECT ''Index idx_league_id already exists in tournament'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND INDEX_NAME = 'idx_event_id'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE tournament ADD INDEX idx_event_id (event_id)',
  'SELECT ''Index idx_event_id already exists in tournament'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- Rename settings table if it hasn't been renamed yet (idempotent)
SET @table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'settings'
);

SET @old_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings_old'
);

SET @sql = IF(@table_exists = 1 AND @old_table_exists = 0,
  'RENAME TABLE settings TO league_settings_old',
  'SELECT ''Table settings already renamed or does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- League settings: Per-league configuration
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
-- DATA MIGRATION - Create default billing entity and league (IDEMPOTENT)
-- ============================================================================

-- Check if default entity already exists
SET @entity_exists = (
  SELECT COUNT(*)
  FROM billing_entities
  WHERE slug = 'paradise-golf'
);

-- Create default billing entity only if it doesn't exist
SET @sql = IF(@entity_exists = 0,
  'INSERT INTO billing_entities (name, slug, entity_type, description, active) VALUES (''Paradise Golf'', ''paradise-golf'', ''league_organization'', ''Original Paradise Golf league organization'', 1)',
  'SELECT ''Default billing entity already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Get the default entity ID
SET @default_entity_id = (SELECT id FROM billing_entities WHERE slug = 'paradise-golf' LIMIT 1);

-- Check if default league already exists
SET @league_exists = (
  SELECT COUNT(*)
  FROM leagues
  WHERE slug = 'paradise-golf-league'
);

-- Create default league only if it doesn't exist
SET @sql = IF(@league_exists = 0,
  CONCAT('INSERT INTO leagues (billing_entity_id, name, slug, description, season_year, active) VALUES (', @default_entity_id, ', ''Paradise Golf League'', ''paradise-golf-league'', ''Main competitive league'', YEAR(CURDATE()), 1)'),
  'SELECT ''Default league already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Get the default league ID
SET @default_league_id = (SELECT id FROM leagues WHERE slug = 'paradise-golf-league' LIMIT 1);

-- Assign players to default billing entity (only if they don't have one)
UPDATE players 
SET billing_entity_id = @default_entity_id
WHERE billing_entity_id IS NULL;

-- Make billing_entity_id NOT NULL if all players have been assigned (idempotent)
SET @null_count = (SELECT COUNT(*) FROM players WHERE billing_entity_id IS NULL);

SET @column_nullable = (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'players'
    AND COLUMN_NAME = 'billing_entity_id'
);

SET @sql = IF(@null_count = 0 AND @column_nullable = 'YES',
  'ALTER TABLE players MODIFY COLUMN billing_entity_id INT UNSIGNED NOT NULL',
  'SELECT ''Cannot make billing_entity_id NOT NULL - some players still have NULL values or already NOT NULL'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create billing entity roles for players (idempotent - skip existing)
INSERT IGNORE INTO billing_entity_roles (billing_entity_id, player_id, role)
SELECT 
  @default_entity_id,
  id,
  CASE 
    WHEN role = 'admin' THEN 'admin'
    ELSE 'member'
  END
FROM players;

-- Add active players to default league (idempotent - skip existing)
INSERT IGNORE INTO league_players (league_id, player_id)
SELECT @default_league_id, id 
FROM players 
WHERE active = 1;

-- Migrate player stats to league_player_stats (idempotent - skip existing)
INSERT IGNORE INTO league_player_stats (league_id, player_id, quota_18, quota_9, fedex_points, tournaments_played, prize_money)
SELECT 
  @default_league_id,
  id,
  quota_18,
  quota_9,
  fedex_points,
  tournaments_played,
  prize_money
FROM players;

-- Update tournaments to belong to default league (only if they don't have one)
UPDATE tournament 
SET league_id = @default_league_id
WHERE league_id IS NULL AND event_id IS NULL;

-- Add CHECK constraint (idempotent)
SET @constraint_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tournament'
    AND CONSTRAINT_NAME = 'chk_tournament_parent'
);

SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE tournament ADD CONSTRAINT chk_tournament_parent CHECK ((league_id IS NOT NULL AND event_id IS NULL) OR (league_id IS NULL AND event_id IS NOT NULL))',
  'SELECT ''CHECK constraint chk_tournament_parent already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update quota tables to default league (only NULL values)
UPDATE quota 
SET league_id = @default_league_id
WHERE league_id IS NULL;

UPDATE skins_quota 
SET league_id = @default_league_id
WHERE league_id IS NULL;

-- Make league_id NOT NULL in quota tables (idempotent)
SET @null_count_quota = (SELECT COUNT(*) FROM quota WHERE league_id IS NULL);

SET @column_nullable = (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quota'
    AND COLUMN_NAME = 'league_id'
);

SET @sql = IF(@null_count_quota = 0 AND @column_nullable = 'YES',
  'ALTER TABLE quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL',
  'SELECT ''Cannot make quota.league_id NOT NULL - some rows still have NULL values or already NOT NULL'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @null_count_skins = (SELECT COUNT(*) FROM skins_quota WHERE league_id IS NULL);

SET @column_nullable = (
  SELECT IS_NULLABLE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'skins_quota'
    AND COLUMN_NAME = 'league_id'
);

SET @sql = IF(@null_count_skins = 0 AND @column_nullable = 'YES',
  'ALTER TABLE skins_quota MODIFY COLUMN league_id INT UNSIGNED NOT NULL',
  'SELECT ''Cannot make skins_quota.league_id NOT NULL - some rows still have NULL values or already NOT NULL'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate settings to league settings (idempotent - check if already migrated)
SET @league_settings_count = (SELECT COUNT(*) FROM league_settings WHERE league_id = @default_league_id);

SET @old_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'league_settings_old'
);

SET @sql = IF(@league_settings_count = 0 AND @old_table_exists = 1,
  CONCAT('INSERT INTO league_settings (league_id, tournament_fee_18_holes, tournament_fee_9_holes, skins_ctp_fee_18_holes, skins_ctp_fee_9_holes, golf_course_email) SELECT ', @default_league_id, ', tournament_fee_18_holes, tournament_fee_9_holes, skins_ctp_fee_18_holes, skins_ctp_fee_9_holes, golf_course_email FROM league_settings_old LIMIT 1'),
  'SELECT ''League settings already migrated or old table does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Insert default global settings (idempotent)
INSERT IGNORE INTO global_settings (setting_key, setting_value, description, data_type) VALUES
('default_tournament_fee_18', '20.00', 'Default tournament fee for 18-hole events', 'number'),
('default_tournament_fee_9', '10.00', 'Default tournament fee for 9-hole events', 'number'),
('default_skins_fee_18', '10.00', 'Default skins/CTP fee for 18-hole events', 'number'),
('default_skins_fee_9', '5.00', 'Default skins/CTP fee for 9-hole events', 'number'),
('system_timezone', 'America/Los_Angeles', 'System default timezone', 'string'),
('max_players_per_tournament', '100', 'Maximum players per tournament', 'number');
