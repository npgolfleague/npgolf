SELECT 'players' AS tbl, COUNT(*) AS total, SUM(billing_entity_id IS NULL) AS null_be, SUM(billing_entity_id != 1) AS not_be_1 FROM players
UNION ALL
SELECT 'tournament', COUNT(*), NULL, SUM(league_id IS NULL OR league_id != 1) FROM tournament
UNION ALL
SELECT 'quota', COUNT(*), NULL, SUM(league_id IS NULL OR league_id != 1) FROM quota
UNION ALL
SELECT 'skins_quota', COUNT(*), NULL, SUM(league_id IS NULL OR league_id != 1) FROM skins_quota
UNION ALL
SELECT 'league_players', COUNT(*), NULL, SUM(league_id IS NULL OR league_id != 1) FROM league_players
UNION ALL
SELECT 'league_settings', COUNT(*), NULL, SUM(league_id IS NULL OR league_id != 1) FROM league_settings
UNION ALL
SELECT 'leagues', COUNT(*), SUM(billing_entity_id IS NULL), SUM(billing_entity_id != 1) FROM leagues;
