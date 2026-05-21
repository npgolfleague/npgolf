-- 006_add_quota_column_to_players.sql
USE npgolf;

ALTER TABLE players ADD COLUMN quota DECIMAL(5,2) DEFAULT NULL AFTER active;
