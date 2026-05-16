-- Migration 047: Add default_tee_name to players table
-- Stores the player's preferred tee name (e.g. 'White', 'Red', 'Blue').
-- This is a tee name string rather than a FK to course_tee because a player's
-- preference spans all courses; the actual course_tee id is resolved at
-- tournament-player insertion time by matching against the tournament's course.

ALTER TABLE players
  ADD COLUMN default_tee_name VARCHAR(20) DEFAULT NULL
    COMMENT 'Player''s preferred tee name (e.g. White, Red, Blue). Used as the default when adding the player to a tournament.';
