-- ============================================================================
-- Migration 058: Drop unused tables and the never-used "events" feature
-- Date: 2026-11-14
--
-- None of these tables are read or written by src/ or frontend/:
--   users                    legacy login table, replaced by players
--   tournament_pairings      legacy pairing table, replaced by tournament_players.foursome
--   league_settings_old      the pre-multi-league `settings` table, copied into league_settings by 002
--   global_settings          seeded defaults that nothing reads
--   billing_entity_settings  never written
--   subscription_plans, subscriptions, payments, invoices
--                            billing scaffolding from 003; no code uses it
--   events, event_participants
--                            one-off events; no tournament has ever used event_id
--
-- With events gone every tournament belongs to a league, so the
-- chk_tournament_parent CHECK is replaced by tournament.league_id NOT NULL.
--
-- Idempotent: safe to re-run if it fails partway.
-- TAKE A BACKUP FIRST: this drops tables and their rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Billing scaffolding (child tables first)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS subscription_plans;
DROP TABLE IF EXISTS billing_entity_settings;

-- ---------------------------------------------------------------------------
-- Events: unhook tournament.event_id, then drop the tables
-- ---------------------------------------------------------------------------

-- The CHECK must go before the column it references.
SET @s = (SELECT IF(COUNT(*) > 0,
  'ALTER TABLE tournament DROP CHECK chk_tournament_parent', 'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament'
    AND CONSTRAINT_NAME = 'chk_tournament_parent' AND CONSTRAINT_TYPE = 'CHECK');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- FK name may differ between databases, so look it up by column.
SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament'
    AND COLUMN_NAME = 'event_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @s = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE tournament DROP FOREIGN KEY `', @fk, '`'));
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) > 0, 'ALTER TABLE tournament DROP INDEX idx_event_id', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament' AND INDEX_NAME = 'idx_event_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) > 0, 'ALTER TABLE tournament DROP COLUMN event_id', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament' AND COLUMN_NAME = 'event_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

DROP TABLE IF EXISTS event_participants;
DROP TABLE IF EXISTS events;

-- Every tournament now needs a league. (All existing rows already have one;
-- this fails loudly rather than guessing if some database has a NULL.)
SET @s = (SELECT IF(IS_NULLABLE = 'YES',
  'ALTER TABLE tournament MODIFY COLUMN league_id INT UNSIGNED NOT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tournament' AND COLUMN_NAME = 'league_id');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- Legacy tables
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tournament_pairings;
DROP TABLE IF EXISTS league_settings_old;
DROP TABLE IF EXISTS global_settings;
