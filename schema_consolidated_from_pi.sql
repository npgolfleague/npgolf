
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
CREATE TABLE `course` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  PRIMARY KEY (`id`),
  KEY `idx_received_at` (`received_at` DESC),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hole` (
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
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `players` (
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
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
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
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scores` (
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
) ENGINE=InnoDB AUTO_INCREMENT=1229 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '20.00' COMMENT 'Tournament fee for 18 hole events',
  `tournament_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '10.00' COMMENT 'Tournament fee for 9 hole events',
  `golf_course_email` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `skins_ctp_fee_18_holes` decimal(10,2) NOT NULL DEFAULT '10.00' COMMENT 'Optional skins/CTP fee for 18 hole events',
  `skins_ctp_fee_9_holes` decimal(10,2) NOT NULL DEFAULT '5.00' COMMENT 'Optional skins/CTP fee for 9 hole events',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Application settings';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skins_quota` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `player_id` int unsigned NOT NULL,
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
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `skins_quota_ibfk_1` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `first_tee_time` time DEFAULT NULL,
  `course_id` int unsigned NOT NULL,
  `number_of_holes` tinyint unsigned NOT NULL DEFAULT '18',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `in_progress` tinyint(1) DEFAULT '0' COMMENT 'Tournament is currently in progress',
  `completed` tinyint(1) DEFAULT '0' COMMENT 'Tournament is completed',
  `nine_hole_side` enum('front','back') NOT NULL DEFAULT 'front',
  `quota_collected` decimal(10,2) DEFAULT NULL,
  `skins_collected` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_in_progress` (`in_progress`),
  KEY `idx_completed` (`completed`),
  CONSTRAINT `tournament_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `course` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_pairings` (
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
) ENGINE=InnoDB AUTO_INCREMENT=114 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_players` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tournament_id` int unsigned NOT NULL,
  `player_id` int unsigned NOT NULL,
  `registration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player has paid tournament fee (0 = not paid, 1 = paid)',
  `attending_status` enum('pending','yes','no') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `response_date` timestamp NULL DEFAULT NULL,
  `skins_ctp_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)',
  `tournament_quota` int DEFAULT NULL COMMENT 'Saved player quota used for this specific tournament',
  `foursome` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pair` smallint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tournament_player` (`tournament_id`,`player_id`),
  KEY `idx_tournament_id` (`tournament_id`),
  KEY `idx_player_id` (`player_id`),
  CONSTRAINT `tournament_players_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournament` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournament_players_ibfk_2` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tournament_results_email` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tournament_id` int NOT NULL,
  `subject` varchar(500) DEFAULT NULL,
  `html` mediumtext,
  `generated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournament` (`tournament_id`),
  KEY `idx_tournament_id` (`tournament_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

