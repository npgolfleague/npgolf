-- 009_add_player_stats.sql
-- Add FedEx Cup points, tournaments played, and prize money columns to players table
USE npgolf;

ALTER TABLE players 
  ADD COLUMN fedex_points INT DEFAULT 0 AFTER quota,
  ADD COLUMN tournaments_played INT DEFAULT 0 AFTER fedex_points,
  ADD COLUMN prize_money DECIMAL(12,2) DEFAULT 0.00 AFTER tournaments_played;
