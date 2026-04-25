-- Migration: Add foursome_pair column to tournament_players
ALTER TABLE tournament_players
  ADD COLUMN foursome_pair SMALLINT NULL AFTER foursome_group;
