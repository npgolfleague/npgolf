ALTER TABLE tournament_players
ADD COLUMN tournament_quota INT DEFAULT NULL
COMMENT 'Saved player quota used for this specific tournament';
