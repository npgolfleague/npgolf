-- npgolf schema snapshot (structure only), as of migration 064. Regenerate with scripts/export-schema.sh.

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing_entities` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `slug` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `entity_type` enum('golf_course','league_organization','event_company','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'league_organization',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `logo_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `website` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `timezone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'America/Los_Angeles',
  `billing_email` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `billing_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `billing_address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `stripe_customer_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  UNIQUE KEY `stripe_customer_id` (`stripe_customer_id`),
  KEY `idx_entity_type` (`entity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing_entity_roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_entity_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `role` enum('owner','admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'member',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_entity_player` (`billing_entity_id`,`player_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_role` (`role`),
  CONSTRAINT `billing_entity_roles_ibfk_1` FOREIGN KEY (`billing_entity_id`) REFERENCES `billing_entities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `billing_entity_roles_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `created_by_entity_id` int unsigned DEFAULT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1=anyone can use, 0=only creating entity',
  `name` varchar(191) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created_by_entity` (`created_by_entity_id`),
  CONSTRAINT `fk_course_entity` FOREIGN KEY (`created_by_entity_id`) REFERENCES `billing_entities` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_tee` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `course_id` int unsigned NOT NULL,
  `tee_name` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'e.g. Black, Blue, White, Gold, Red',
  `tee_color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '#FFFFFF' COMMENT 'CSS color for UI display',
  `gender` enum('M','F','A') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'A' COMMENT 'M = mens only, F = ladies only, A = applicable to all',
  `course_rating` decimal(4,1) DEFAULT NULL COMMENT 'e.g. 72.4',
  `slope_rating` smallint unsigned DEFAULT NULL COMMENT 'e.g. 138',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_course_tee` (`course_id`,`tee_name`),
  CONSTRAINT `fk_course_tee_course` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(255) DEFAULT NULL,
  `to_email` varchar(255) DEFAULT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `text` text,
  `html` mediumtext,
  `received_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint(1) DEFAULT '0',
  `message_id` varchar(255) DEFAULT NULL COMMENT 'IMAP/SMTP Message-ID header for deduplication',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_message_id` (`message_id`),
  KEY `idx_received_at` (`received_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `foursome_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `foursome_group` varchar(100) NOT NULL,
  `posted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `posted_by` int unsigned DEFAULT NULL,
  `status` enum('posted','awaiting_marker','disputed') NOT NULL DEFAULT 'posted',
  `attested_by` int unsigned DEFAULT NULL,
  `attested_at` datetime DEFAULT NULL,
  `dispute_note` varchar(500) DEFAULT NULL,
  `disputed_by` int unsigned DEFAULT NULL,
  `disputed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tournament_foursome` (`tournament_id`,`foursome_group`),
  KEY `fk_fp_player` (`posted_by`),
  KEY `fk_fp_attested_by` (`attested_by`),
  KEY `fk_fp_disputed_by` (`disputed_by`),
  CONSTRAINT `fk_fp_attested_by` FOREIGN KEY (`attested_by`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fp_disputed_by` FOREIGN KEY (`disputed_by`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fp_player` FOREIGN KEY (`posted_by`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_fp_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hole` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `course_id` int unsigned NOT NULL,
  `hole_number` tinyint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_course_hole` (`course_id`,`hole_number`),
  CONSTRAINT `hole_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hole_tee` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `hole_id` int unsigned NOT NULL,
  `tee_id` int unsigned NOT NULL,
  `distance` int unsigned NOT NULL COMMENT 'Yards from this tee to the hole',
  `par` tinyint unsigned NOT NULL COMMENT '3, 4, or 5',
  `handicap` tinyint unsigned NOT NULL COMMENT 'Stroke index 1-18',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_hole_tee` (`hole_id`,`tee_id`),
  KEY `idx_tee_id` (`tee_id`),
  CONSTRAINT `fk_hole_tee_hole` FOREIGN KEY (`hole_id`) REFERENCES `hole` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hole_tee_tee` FOREIGN KEY (`tee_id`) REFERENCES `course_tee` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_player_stats` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `quota_18` int DEFAULT NULL,
  `quota_9` int DEFAULT NULL,
  `fedex_points` int DEFAULT '0',
  `tournaments_played` int DEFAULT '0',
  `prize_money` decimal(10,2) DEFAULT '0.00',
  `current_rank` int unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_league_player_stats` (`league_id`,`player_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_fedex_points` (`fedex_points` DESC),
  CONSTRAINT `league_player_stats_ibfk_1` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `league_player_stats_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `league_player_totals` AS SELECT 
 1 AS `league_id`,
 1 AS `player_id`,
 1 AS `fedex_points`,
 1 AS `tournaments_played`,
 1 AS `prize_money`*/;
SET character_set_client = @saved_cs_client;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `quota_18` int DEFAULT NULL,
  `quota_9` int DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_league_player` (`league_id`,`player_id`),
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `league_players_ibfk_1` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `league_players_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_rulesets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'draft',
  `content_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `effective_from` date DEFAULT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `published_by` int unsigned DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_rulesets_created_by` (`created_by`),
  KEY `fk_rulesets_published_by` (`published_by`),
  KEY `idx_rulesets_league` (`league_id`),
  KEY `idx_rulesets_status` (`status`),
  KEY `idx_rulesets_effective` (`effective_from`,`effective_to`),
  CONSTRAINT `fk_rulesets_created_by` FOREIGN KEY (`created_by`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rulesets_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rulesets_published_by` FOREIGN KEY (`published_by`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_seasons` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `season_year` int unsigned NOT NULL,
  `championship_pot` decimal(10,2) NOT NULL DEFAULT '0.00',
  `losers_bracket_pot` decimal(10,2) NOT NULL DEFAULT '0.00',
  `champion_player_id` int unsigned DEFAULT NULL,
  `champion_tiebreak_player_id` int unsigned DEFAULT NULL,
  `losers_winner_player_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_league_season` (`league_id`,`season_year`),
  KEY `idx_season_year` (`season_year`),
  KEY `fk_ls_champion` (`champion_player_id`),
  KEY `fk_ls_champion_tiebreak` (`champion_tiebreak_player_id`),
  KEY `fk_ls_losers_winner` (`losers_winner_player_id`),
  CONSTRAINT `fk_league_seasons_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ls_champion` FOREIGN KEY (`champion_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ls_champion_tiebreak` FOREIGN KEY (`champion_tiebreak_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ls_losers_winner` FOREIGN KEY (`losers_winner_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `tournament_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '20.00',
  `tournament_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '10.00',
  `skins_ctp_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '10.00',
  `skins_ctp_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '5.00',
  `golf_course_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `outgoing_email_from` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'Optional FROM address for outgoing league emails',
  `additional_settings` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `quota_points_albatross` int NOT NULL DEFAULT '8' COMMENT 'Points for albatross (3 under par)',
  `quota_points_eagle` int NOT NULL DEFAULT '8' COMMENT 'Points for eagle (2 under par)',
  `quota_points_birdie` int NOT NULL DEFAULT '6' COMMENT 'Points for birdie (1 under par)',
  `quota_points_par` int NOT NULL DEFAULT '4' COMMENT 'Points for par',
  `quota_points_bogey` int NOT NULL DEFAULT '2' COMMENT 'Points for bogey (1 over par)',
  `quota_points_double_bogey` int NOT NULL DEFAULT '1' COMMENT 'Points for double bogey (2 over par)',
  `quota_points_worse` int NOT NULL DEFAULT '0' COMMENT 'Points for worse than double bogey',
  `live_scoring` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'If 1, scores are visible on leaderboard as they are entered. If 0, only visible after foursome posts scores.',
  `require_card_attest` tinyint(1) NOT NULL DEFAULT '0',
  `playoff_format` enum('none','fedex_cup') NOT NULL DEFAULT 'none',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_league` (`league_id`),
  CONSTRAINT `league_settings_ibfk_1` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `league_side_game_defaults` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `game_type` enum('blind_draw','quota_nassau','birdie_pot') NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `fee_9` decimal(10,2) NOT NULL DEFAULT '2.00',
  `fee_18` decimal(10,2) NOT NULL DEFAULT '5.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_league_side_game` (`league_id`,`game_type`),
  CONSTRAINT `fk_lsgd_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leagues` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_entity_id` int unsigned NOT NULL,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `slug` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `cup_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Paradise Cup',
  `alias` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `season_year` int unsigned DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_entity_slug` (`billing_entity_id`,`slug`),
  UNIQUE KEY `alias` (`alias`),
  KEY `idx_season_year` (`season_year`),
  CONSTRAINT `leagues_ibfk_1` FOREIGN KEY (`billing_entity_id`) REFERENCES `billing_entities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_entity_id` int unsigned NOT NULL,
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
  `role` enum('player','league_admin','admin','super_admin') DEFAULT 'player',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `sms_allowed` tinyint(1) NOT NULL DEFAULT '0',
  `email_allowed` tinyint(1) NOT NULL DEFAULT '1',
  `reset_password_token_hash` varchar(64) DEFAULT NULL,
  `reset_password_expires` datetime DEFAULT NULL,
  `refresh_token_hash` varchar(255) DEFAULT NULL,
  `refresh_token_expires` datetime DEFAULT NULL,
  `default_tee_name` varchar(20) DEFAULT NULL COMMENT 'Player''s preferred tee name (e.g. White, Red, Blue). Used as the default when adding the player to a tournament.',
  PRIMARY KEY (`id`),
  KEY `idx_billing_entity_id` (`billing_entity_id`),
  CONSTRAINT `fk_players_billing_entity` FOREIGN KEY (`billing_entity_id`) REFERENCES `billing_entities` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
  `league_id` int unsigned NOT NULL,
  `date_1` date DEFAULT NULL,
  `points_1` int DEFAULT NULL,
  `date_2` date DEFAULT NULL,
  `points_2` int DEFAULT NULL,
  `date_3` date DEFAULT NULL,
  `points_3` int DEFAULT NULL,
  `date_4` date DEFAULT NULL,
  `points_4` int DEFAULT NULL,
  `date_5` date DEFAULT NULL,
  `points_5` int DEFAULT NULL,
  `date_6` date DEFAULT NULL,
  `points_6` int DEFAULT NULL,
  `date_7` date DEFAULT NULL,
  `points_7` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `quota_diff_1` int DEFAULT NULL,
  `holes_1` tinyint unsigned DEFAULT NULL,
  `quota_diff_2` int DEFAULT NULL,
  `holes_2` tinyint unsigned DEFAULT NULL,
  `quota_diff_3` int DEFAULT NULL,
  `holes_3` tinyint unsigned DEFAULT NULL,
  `quota_diff_4` int DEFAULT NULL,
  `holes_4` tinyint unsigned DEFAULT NULL,
  `quota_diff_5` int DEFAULT NULL,
  `holes_5` tinyint unsigned DEFAULT NULL,
  `quota_diff_6` int DEFAULT NULL,
  `holes_6` tinyint unsigned DEFAULT NULL,
  `quota_diff_7` int DEFAULT NULL,
  `holes_7` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quota_player_league` (`player_id`,`league_id`),
  KEY `idx_league_id` (`league_id`),
  CONSTRAINT `fk_quota_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scores` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entered_at` timestamp(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `hole_id` int unsigned NOT NULL,
  `score` tinyint unsigned NOT NULL,
  `quota` int DEFAULT NULL,
  `foursome_group` varchar(50) DEFAULT NULL,
  `ctp_feet` int unsigned DEFAULT NULL,
  `ctp_inches` decimal(3,1) DEFAULT NULL,
  `ctp_image_url` mediumtext,
  `foursome_ctp_feet` int unsigned DEFAULT NULL,
  `foursome_ctp_inches` decimal(3,1) DEFAULT NULL,
  `foursome_ctp_image_url` mediumtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player_hole` (`tournament_id`,`player_id`,`hole_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `idx_hole_id` (`hole_id`),
  CONSTRAINT `scores_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scores_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scores_ibfk_3` FOREIGN KEY (`hole_id`) REFERENCES `hole` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `season_player_stats` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `season_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `regular_points` decimal(10,2) NOT NULL DEFAULT '0.00',
  `playoff_points` decimal(10,2) NOT NULL DEFAULT '0.00',
  `losers_bracket_points` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_player` (`season_id`,`player_id`),
  KEY `idx_sps_player_id` (`player_id`),
  CONSTRAINT `fk_sps_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sps_season` FOREIGN KEY (`season_id`) REFERENCES `league_seasons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skins_quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
  `league_id` int unsigned NOT NULL,
  `date_1` date DEFAULT NULL,
  `points_1` int DEFAULT NULL,
  `date_2` date DEFAULT NULL,
  `points_2` int DEFAULT NULL,
  `date_3` date DEFAULT NULL,
  `points_3` int DEFAULT NULL,
  `date_4` date DEFAULT NULL,
  `points_4` int DEFAULT NULL,
  `date_5` date DEFAULT NULL,
  `points_5` int DEFAULT NULL,
  `date_6` date DEFAULT NULL,
  `points_6` int DEFAULT NULL,
  `date_7` date DEFAULT NULL,
  `points_7` int DEFAULT NULL,
  `date_8` date DEFAULT NULL,
  `points_8` int DEFAULT NULL,
  `date_9` date DEFAULT NULL,
  `points_9` int DEFAULT NULL,
  `date_10` date DEFAULT NULL,
  `points_10` int DEFAULT NULL,
  `date_11` date DEFAULT NULL,
  `points_11` int DEFAULT NULL,
  `date_12` date DEFAULT NULL,
  `points_12` int DEFAULT NULL,
  `date_13` date DEFAULT NULL,
  `points_13` int DEFAULT NULL,
  `date_14` date DEFAULT NULL,
  `points_14` int DEFAULT NULL,
  `date_15` date DEFAULT NULL,
  `points_15` int DEFAULT NULL,
  `date_16` date DEFAULT NULL,
  `points_16` int DEFAULT NULL,
  `date_17` date DEFAULT NULL,
  `points_17` int DEFAULT NULL,
  `date_18` date DEFAULT NULL,
  `points_18` int DEFAULT NULL,
  `date_19` date DEFAULT NULL,
  `points_19` int DEFAULT NULL,
  `date_20` date DEFAULT NULL,
  `points_20` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `quota_diff_1` int DEFAULT NULL,
  `quota_diff_2` int DEFAULT NULL,
  `quota_diff_3` int DEFAULT NULL,
  `quota_diff_4` int DEFAULT NULL,
  `quota_diff_5` int DEFAULT NULL,
  `quota_diff_6` int DEFAULT NULL,
  `quota_diff_7` int DEFAULT NULL,
  `quota_diff_8` int DEFAULT NULL,
  `quota_diff_9` int DEFAULT NULL,
  `quota_diff_10` int DEFAULT NULL,
  `quota_diff_11` int DEFAULT NULL,
  `quota_diff_12` int DEFAULT NULL,
  `quota_diff_13` int DEFAULT NULL,
  `quota_diff_14` int DEFAULT NULL,
  `quota_diff_15` int DEFAULT NULL,
  `quota_diff_16` int DEFAULT NULL,
  `quota_diff_17` int DEFAULT NULL,
  `quota_diff_18` int DEFAULT NULL,
  `quota_diff_19` int DEFAULT NULL,
  `quota_diff_20` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_skins_quota_player_league` (`player_id`,`league_id`),
  KEY `idx_league_id` (`league_id`),
  CONSTRAINT `fk_skins_quota_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `skins_quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `league_id` int unsigned NOT NULL,
  `date` date NOT NULL,
  `first_tee_time` time DEFAULT NULL,
  `shotgun_start` tinyint(1) NOT NULL DEFAULT '0',
  `standard_quota_game` tinyint(1) NOT NULL DEFAULT '1',
  `course_id` int unsigned NOT NULL,
  `number_of_holes` tinyint unsigned NOT NULL DEFAULT '18',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `in_progress` tinyint(1) DEFAULT '0' COMMENT 'Tournament is currently in progress',
  `completed` tinyint(1) DEFAULT '0' COMMENT 'Tournament is completed',
  `nine_hole_side` enum('front','back') NOT NULL DEFAULT 'front',
  `quota_collected` decimal(10,2) DEFAULT NULL,
  `skins_collected` decimal(10,2) DEFAULT NULL,
  `season_id` int unsigned DEFAULT NULL,
  `playoff_stage` enum('regular','semifinal','final') NOT NULL DEFAULT 'regular',
  `playoff_override_semifinal_player_ids` json DEFAULT NULL,
  `playoff_override_final_player_ids` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_league_id` (`league_id`),
  KEY `idx_season_id` (`season_id`),
  KEY `idx_playoff_stage` (`playoff_stage`),
  CONSTRAINT `fk_tournament_league` FOREIGN KEY (`league_id`) REFERENCES `leagues` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tournament_season` FOREIGN KEY (`season_id`) REFERENCES `league_seasons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tournament_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_completion_backups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `backup_data` json NOT NULL,
  `restored_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tcb_tournament_id` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_ctp_winners` (
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_paradise_points` (
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_payouts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `category` enum('quota','skins','ctp','side_games') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payout` (`tournament_id`,`player_id`,`category`),
  KEY `idx_payout_player` (`player_id`),
  CONSTRAINT `fk_payout_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payout_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `registration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player has paid tournament fee (0 = not paid, 1 = paid)',
  `attending_status` enum('pending','yes','no') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'pending',
  `response_date` timestamp NULL DEFAULT NULL,
  `skins_ctp_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)',
  `tournament_quota` int DEFAULT NULL COMMENT 'Saved player quota used for this specific tournament',
  `foursome` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `pair` smallint DEFAULT NULL,
  `tee_id` int unsigned DEFAULT NULL COMMENT 'Which tee this player plays from in this tournament (FK to course_tee)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player` (`tournament_id`,`player_id`),
  KEY `idx_player_id` (`player_id`),
  KEY `fk_tp_tee` (`tee_id`),
  CONSTRAINT `fk_tp_tee` FOREIGN KEY (`tee_id`) REFERENCES `course_tee` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tournament_players_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_players_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_playoff_points` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `season_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `bracket_type` enum('playoff','losers') NOT NULL,
  `result_type` enum('seed','performance') NOT NULL,
  `playoff_week` tinyint unsigned NOT NULL,
  `rank_position` int unsigned DEFAULT NULL,
  `tie_group_size` int unsigned NOT NULL DEFAULT '1',
  `over_under` decimal(10,2) NOT NULL DEFAULT '0.00',
  `points_awarded` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cumulative_points_after` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament_player_result` (`tournament_id`,`player_id`,`bracket_type`,`result_type`),
  KEY `idx_tpp_season_id` (`season_id`),
  KEY `idx_tpp_player_id` (`player_id`),
  KEY `idx_tpp_bracket_type` (`bracket_type`),
  CONSTRAINT `fk_tpp_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tpp_season` FOREIGN KEY (`season_id`) REFERENCES `league_seasons` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tpp_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_results_email` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `html` mediumtext,
  `generated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament` (`tournament_id`),
  CONSTRAINT `fk_tre_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_side_game_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `game_type` enum('blind_draw','quota_nassau','birdie_pot') NOT NULL,
  `player_id` int unsigned NOT NULL,
  `paid` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_side_game_entry` (`tournament_id`,`game_type`,`player_id`),
  KEY `idx_sge_player` (`player_id`),
  CONSTRAINT `fk_sge_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sge_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_side_game_results` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `game_type` enum('blind_draw','quota_nassau','birdie_pot') NOT NULL,
  `segment` varchar(20) NOT NULL DEFAULT 'overall',
  `player_id` int unsigned NOT NULL,
  `team_no` smallint unsigned DEFAULT NULL,
  `score` decimal(8,2) DEFAULT NULL,
  `shares` smallint unsigned DEFAULT NULL,
  `is_winner` tinyint(1) NOT NULL DEFAULT '0',
  `prize_money` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_side_game_result` (`tournament_id`,`game_type`,`segment`,`player_id`),
  KEY `idx_sgr_player` (`player_id`),
  CONSTRAINT `fk_sgr_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sgr_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_side_game_teams` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `team_no` smallint unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_side_game_team_player` (`tournament_id`,`player_id`),
  KEY `idx_sgt_player` (`player_id`),
  CONSTRAINT `fk_sgt_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sgt_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_side_games` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `game_type` enum('blind_draw','quota_nassau','birdie_pot') NOT NULL,
  `fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `collected` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament_side_game` (`tournament_id`,`game_type`),
  CONSTRAINT `fk_tsg_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_skin_winners` (
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50001 DROP VIEW IF EXISTS `league_player_totals`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `league_player_totals` AS select `lp`.`league_id` AS `league_id`,`lp`.`player_id` AS `player_id`,cast(coalesce(`pts`.`fedex_points`,0) as signed) AS `fedex_points`,cast(coalesce(`pts`.`tournaments_played`,0) as signed) AS `tournaments_played`,cast(coalesce(`pay`.`prize_money`,0) as decimal(10,2)) AS `prize_money` from ((`league_players` `lp` left join (select `t`.`league_id` AS `league_id`,`tpp`.`player_id` AS `player_id`,sum(`tpp`.`points_awarded`) AS `fedex_points`,count(0) AS `tournaments_played` from (`tournament_paradise_points` `tpp` join `tournament` `t` on((`t`.`id` = `tpp`.`tournament_id`))) group by `t`.`league_id`,`tpp`.`player_id`) `pts` on(((`pts`.`league_id` = `lp`.`league_id`) and (`pts`.`player_id` = `lp`.`player_id`)))) left join (select `t`.`league_id` AS `league_id`,`po`.`player_id` AS `player_id`,sum(`po`.`amount`) AS `prize_money` from (`tournament_payouts` `po` join `tournament` `t` on((`t`.`id` = `po`.`tournament_id`))) group by `t`.`league_id`,`po`.`player_id`) `pay` on(((`pay`.`league_id` = `lp`.`league_id`) and (`pay`.`player_id` = `lp`.`player_id`)))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

