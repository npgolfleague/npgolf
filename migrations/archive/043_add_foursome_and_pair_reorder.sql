-- Migration 043: Add `foursome` and `pair` columns at the front of tournament_players
-- and migrate existing data from `foursome_group`/`foursome_pair` if present.
ALTER TABLE tournament_players
  ADD COLUMN IF NOT EXISTS `foursome` VARCHAR(50) NULL FIRST,
  ADD COLUMN IF NOT EXISTS `pair` SMALLINT NULL AFTER `foursome`;

-- Populate new columns from old columns if they exist
UPDATE tournament_players
SET foursome = COALESCE(foursome, foursome_group),
    pair = COALESCE(pair, foursome_pair);

-- Drop legacy columns if present
ALTER TABLE tournament_players
  DROP COLUMN IF EXISTS `foursome_group`,
  DROP COLUMN IF EXISTS `foursome_pair`;

-- Note: This migration reorders columns by adding the new columns with FIRST/AFTER.
