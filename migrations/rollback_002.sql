-- Rollback migration 002_add_billing_entity_hierarchy.sql
-- Use this to undo the partially-applied migration

-- Drop CHECK constraint if exists (MySQL 8.0.19+ syntax)
ALTER TABLE tournament DROP CHECK chk_tournament_parent;

-- Drop foreign keys and columns from tournament
ALTER TABLE tournament DROP FOREIGN KEY IF EXISTS fk_tournament_league;
ALTER TABLE tournament DROP FOREIGN KEY IF EXISTS fk_tournament_event;
ALTER TABLE tournament DROP COLUMN IF EXISTS league_id;
ALTER TABLE tournament DROP COLUMN IF EXISTS event_id;

-- Drop foreign keys and columns from quota tables
ALTER TABLE quota DROP FOREIGN KEY IF EXISTS fk_quota_league;
ALTER TABLE quota DROP COLUMN IF EXISTS league_id;

ALTER TABLE skins_quota DROP FOREIGN KEY IF EXISTS fk_skins_quota_league;
ALTER TABLE skins_quota DROP COLUMN IF EXISTS league_id;

-- Drop foreign keys and columns from course
ALTER TABLE course DROP FOREIGN KEY IF EXISTS fk_course_entity;
ALTER TABLE course DROP COLUMN IF EXISTS created_by_entity_id;
ALTER TABLE course DROP COLUMN IF EXISTS is_public;

-- Drop foreign key and column from players
ALTER TABLE players DROP FOREIGN KEY IF EXISTS fk_players_billing_entity;
ALTER TABLE players DROP COLUMN IF EXISTS billing_entity_id;

-- Drop new tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS event_participants;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS league_player_stats;
DROP TABLE IF EXISTS league_players;
DROP TABLE IF EXISTS leagues;
DROP TABLE IF EXISTS billing_entity_settings;
DROP TABLE IF EXISTS league_settings;
DROP TABLE IF EXISTS global_settings;
DROP TABLE IF EXISTS billing_entity_roles;
DROP TABLE IF EXISTS billing_entities;

-- Restore old settings table if it was renamed
-- RENAME TABLE league_settings_old TO settings;

SELECT 'Rollback of migration 002 complete' AS status;
