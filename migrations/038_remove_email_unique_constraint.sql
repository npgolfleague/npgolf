-- Remove global unique constraint on players.email
-- Email uniqueness will now be enforced per-league at the application level

ALTER TABLE players DROP INDEX IF EXISTS email;
