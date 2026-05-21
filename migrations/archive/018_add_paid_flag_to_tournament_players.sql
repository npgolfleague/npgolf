ALTER TABLE tournament_players
ADD COLUMN paid TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'Whether player has paid tournament fee (0 = not paid, 1 = paid)';
