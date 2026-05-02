-- ============================================================================
-- Migration: Baseline Schema (Consolidated from 47 previous migrations)
-- Date: 2026-05-02
-- Description: Complete database schema as of May 2026
--              This consolidates all migrations from 001 through 047
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS npgolf CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE npgolf;

-- Set session variables for consistent imports
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Course table: Golf courses where tournaments are held
CREATE TABLE IF NOT EXISTS `course` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Hole table: Individual holes for each course
CREATE TABLE IF NOT EXISTS `hole` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `course_id` int unsigned NOT NULL,
  `hole_number` tinyint unsigned NOT NULL,
  `mens_distance` int unsigned NOT NULL,
  `mens_par` tinyint unsigned NOT NULL,
  `mens_handicap` tinyint unsigned NOT NULL,
  `ladies_distance` int unsigned NOT NULL,
  `ladies_par` tinyint unsigned NOT NULL,
  `ladies_handicap` tinyint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_course_hole` (`course_id`,`hole_number`),
  CONSTRAINT `hole_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Players table: All registered players
CREATE TABLE IF NOT EXISTS `players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `sex` enum('M','F') DEFAULT 'M',
  `quota_18` int DEFAULT NULL,
  `quota_9` int DEFAULT NULL,
  `fedex_points` int DEFAULT '0',
  `tournaments_played` int DEFAULT '0',
  `prize_money` decimal(10,2) DEFAULT '0.00',
  `role` enum('player','admin') DEFAULT 'player',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sms_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `email_allowed` tinyint(1) NOT NULL DEFAULT '1',
  `reset_password_token_hash` varchar(64) DEFAULT NULL,
  `reset_password_expires` datetime DEFAULT NULL,
  `refresh_token_hash` varchar(255) DEFAULT NULL,
  `refresh_token_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Quota Tables
-- ============================================================================

-- Quota table: Tracks recent quota points for quota calculation
CREATE TABLE IF NOT EXISTS `quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
  `date_1` date DEFAULT NULL,
  `points_1` int DEFAULT NULL,
  `quota_diff_1` int DEFAULT NULL,
  `holes_1` tinyint unsigned DEFAULT NULL,
  `date_2` date DEFAULT NULL,
  `points_2` int DEFAULT NULL,
  `quota_diff_2` int DEFAULT NULL,
  `holes_2` tinyint unsigned DEFAULT NULL,
  `date_3` date DEFAULT NULL,
  `points_3` int DEFAULT NULL,
  `quota_diff_3` int DEFAULT NULL,
  `holes_3` tinyint unsigned DEFAULT NULL,
  `date_4` date DEFAULT NULL,
  `points_4` int DEFAULT NULL,
  `quota_diff_4` int DEFAULT NULL,
  `holes_4` tinyint unsigned DEFAULT NULL,
  `date_5` date DEFAULT NULL,
  `points_5` int DEFAULT NULL,
  `quota_diff_5` int DEFAULT NULL,
  `holes_5` tinyint unsigned DEFAULT NULL,
  `date_6` date DEFAULT NULL,
  `points_6` int DEFAULT NULL,
  `quota_diff_6` int DEFAULT NULL,
  `holes_6` tinyint unsigned DEFAULT NULL,
  `date_7` date DEFAULT NULL,
  `points_7` int DEFAULT NULL,
  `quota_diff_7` int DEFAULT NULL,
  `holes_7` tinyint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Skins quota table: Tracks recent skins quota points
CREATE TABLE IF NOT EXISTS `skins_quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
  `date_1` date DEFAULT NULL,
  `points_1` int DEFAULT NULL,
  `quota_diff_1` int DEFAULT NULL,
  `date_2` date DEFAULT NULL,
  `points_2` int DEFAULT NULL,
  `quota_diff_2` int DEFAULT NULL,
  `date_3` date DEFAULT NULL,
  `points_3` int DEFAULT NULL,
  `quota_diff_3` int DEFAULT NULL,
  `date_4` date DEFAULT NULL,
  `points_4` int DEFAULT NULL,
  `quota_diff_4` int DEFAULT NULL,
  `date_5` date DEFAULT NULL,
  `points_5` int DEFAULT NULL,
  `quota_diff_5` int DEFAULT NULL,
  `date_6` date DEFAULT NULL,
  `points_6` int DEFAULT NULL,
  `quota_diff_6` int DEFAULT NULL,
  `date_7` date DEFAULT NULL,
  `points_7` int DEFAULT NULL,
  `quota_diff_7` int DEFAULT NULL,
  `date_8` date DEFAULT NULL,
  `points_8` int DEFAULT NULL,
  `quota_diff_8` int DEFAULT NULL,
  `date_9` date DEFAULT NULL,
  `points_9` int DEFAULT NULL,
  `quota_diff_9` int DEFAULT NULL,
  `date_10` date DEFAULT NULL,
  `points_10` int DEFAULT NULL,
  `quota_diff_10` int DEFAULT NULL,
  `date_11` date DEFAULT NULL,
  `points_11` int DEFAULT NULL,
  `quota_diff_11` int DEFAULT NULL,
  `date_12` date DEFAULT NULL,
  `points_12` int DEFAULT NULL,
  `quota_diff_12` int DEFAULT NULL,
  `date_13` date DEFAULT NULL,
  `points_13` int DEFAULT NULL,
  `quota_diff_13` int DEFAULT NULL,
  `date_14` date DEFAULT NULL,
  `points_14` int DEFAULT NULL,
  `quota_diff_14` int DEFAULT NULL,
  `date_15` date DEFAULT NULL,
  `points_15` int DEFAULT NULL,
  `quota_diff_15` int DEFAULT NULL,
  `date_16` date DEFAULT NULL,
  `points_16` int DEFAULT NULL,
  `quota_diff_16` int DEFAULT NULL,
  `date_17` date DEFAULT NULL,
  `points_17` int DEFAULT NULL,
  `quota_diff_17` int DEFAULT NULL,
  `date_18` date DEFAULT NULL,
  `points_18` int DEFAULT NULL,
  `quota_diff_18` int DEFAULT NULL,
  `date_19` date DEFAULT NULL,
  `points_19` int DEFAULT NULL,
  `quota_diff_19` int DEFAULT NULL,
  `date_20` date DEFAULT NULL,
  `points_20` int DEFAULT NULL,
  `quota_diff_20` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `skins_quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Tournament Tables
-- ============================================================================

-- Tournament table: Individual tournament events
CREATE TABLE IF NOT EXISTS `tournament` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `first_tee_time` time DEFAULT NULL,
  `course_id` int unsigned NOT NULL,
  `number_of_holes` tinyint unsigned NOT NULL DEFAULT '18',
  `nine_hole_side` enum('front','back') NOT NULL DEFAULT 'front',
  `in_progress` tinyint(1) DEFAULT '0' COMMENT 'Tournament is currently in progress',
  `completed` tinyint(1) DEFAULT '0' COMMENT 'Tournament is completed',
  `quota_collected` decimal(10,2) DEFAULT NULL,
  `skins_collected` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_in_progress` (`in_progress`),
  KEY `idx_completed` (`completed`),
  CONSTRAINT `tournament_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament players: Players registered for a tournament
CREATE TABLE IF NOT EXISTS `tournament_players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `registration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `attending_status` enum('pending','yes','no') DEFAULT 'pending',
  `response_date` timestamp NULL DEFAULT NULL,
  `paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player has paid tournament fee (0 = not paid, 1 = paid)',
  `skins_ctp_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)',
  `tournament_quota` int DEFAULT NULL COMMENT 'Saved player quota used for this specific tournament',
  `foursome` varchar(50) DEFAULT NULL,
  `pair` smallint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player` (`tournament_id`,`player_id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `tournament_players_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_players_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scores table: Individual hole scores for players in tournaments
CREATE TABLE IF NOT EXISTS `scores` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `hole_id` int unsigned NOT NULL,
  `score` tinyint unsigned NOT NULL,
  `quota` int DEFAULT NULL,
  `foursome_group` varchar(50) DEFAULT NULL,
  `ctp_feet` int unsigned DEFAULT NULL,
  `ctp_inches` decimal(3,1) DEFAULT NULL,
  `ctp_image_url` mediumtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player_hole` (`tournament_id`,`player_id`,`hole_id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_hole_id` (`hole_id`),
  CONSTRAINT `scores_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scores_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scores_ibfk_3` FOREIGN KEY (`hole_id`) REFERENCES `hole` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament completion backups: Backup data when tournaments are completed
CREATE TABLE IF NOT EXISTS `tournament_completion_backups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `backup_data` json NOT NULL,
  `restored_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tcb_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament paradise points: FedEx-style points awarded based on finish
CREATE TABLE IF NOT EXISTS `tournament_paradise_points` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `place` int unsigned NOT NULL,
  `total_quota_points` int NOT NULL,
  `player_quota` int NOT NULL,
  `over_under` int NOT NULL,
  `points_awarded` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player_points` (`tournament_id`,`player_id`),
  KEY `idx_tpp_player_id` (`player_id`),
  CONSTRAINT `tournament_paradise_points_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_paradise_points_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament skin winners: Players who won skins on specific holes
CREATE TABLE IF NOT EXISTS `tournament_skin_winners` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `hole_id` int unsigned NOT NULL,
  `hole_number` tinyint unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `score` tinyint unsigned NOT NULL,
  `prize_money` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_skin_hole` (`tournament_id`,`hole_id`),
  KEY `hole_id` (`hole_id`),
  KEY `player_id` (`player_id`),
  CONSTRAINT `tournament_skin_winners_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_skin_winners_ibfk_2` FOREIGN KEY (`hole_id`) REFERENCES `hole` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_skin_winners_ibfk_3` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament CTP winners: Closest-to-pin winners on par 3 holes
CREATE TABLE IF NOT EXISTS `tournament_ctp_winners` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `hole_id` int unsigned NOT NULL,
  `hole_number` tinyint unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `ctp_feet` int unsigned DEFAULT NULL,
  `ctp_inches` decimal(3,1) DEFAULT NULL,
  `ctp_image_url` mediumtext,
  `prize_money` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_ctp_hole` (`tournament_id`,`hole_id`),
  KEY `hole_id` (`hole_id`),
  KEY `player_id` (`player_id`),
  CONSTRAINT `tournament_ctp_winners_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_ctp_winners_ibfk_2` FOREIGN KEY (`hole_id`) REFERENCES `hole` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_ctp_winners_ibfk_3` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament results email: Cached results emails for tournaments
CREATE TABLE IF NOT EXISTS `tournament_results_email` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `html` mediumtext,
  `generated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament` (`tournament_id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tournament pairings: Legacy table for managing player pairings
CREATE TABLE IF NOT EXISTS `tournament_pairings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `player_id` int NOT NULL,
  `hole_id` int NOT NULL,
  `foursome_group` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament_player_hole` (`tournament_id`,`player_id`,`hole_id`),
  KEY `idx_tournament_hole` (`tournament_id`,`hole_id`),
  KEY `idx_tournament_group` (`tournament_id`,`foursome_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Communication Tables
-- ============================================================================

-- Emails table: Inbound emails received via SendGrid
CREATE TABLE IF NOT EXISTS `emails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(255) DEFAULT NULL,
  `to_email` varchar(255) DEFAULT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `text` text,
  `html` mediumtext,
  `received_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_received_at` (`received_at` DESC),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Settings and Configuration
-- ============================================================================

-- Settings table: Application-wide settings
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '20.00' COMMENT 'Tournament fee for 18 hole events',
  `tournament_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '10.00' COMMENT 'Tournament fee for 9 hole events',
  `skins_ctp_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '10.00' COMMENT 'Optional skins/CTP fee for 18 hole events',
  `skins_ctp_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '5.00' COMMENT 'Optional skins/CTP fee for 9 hole events',
  `golf_course_email` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Application settings';

-- ============================================================================
-- Migration Tracking
-- ============================================================================

-- Schema migrations: Track which migrations have been applied
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Legacy Tables (may be removed in future migrations)
-- ============================================================================

-- Users table: Legacy table, replaced by players
CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================================================
-- Record this migration
-- ============================================================================

INSERT INTO `schema_migrations` (`filename`) VALUES ('001_baseline_schema.sql')
ON DUPLICATE KEY UPDATE filename = filename;

-- Restore session variables
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET SQL_MODE=@OLD_SQL_MODE;
