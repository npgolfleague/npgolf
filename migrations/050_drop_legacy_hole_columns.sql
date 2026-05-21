-- Migration 050: Drop legacy mens_*/ladies_* columns from the hole table
-- *** RUN THIS ONLY AFTER tasks 6 & 7 are complete ***
-- (Update tournament-players.js GET and tournaments.js scoring logic to use
--  hole_tee instead of hole.mens_par / hole.ladies_par etc.)
--
-- All data from these columns was migrated to hole_tee in migration 049.

ALTER TABLE hole
  DROP COLUMN mens_distance,
  DROP COLUMN mens_par,
  DROP COLUMN mens_handicap,
  DROP COLUMN ladies_distance,
  DROP COLUMN ladies_par,
  DROP COLUMN ladies_handicap;
