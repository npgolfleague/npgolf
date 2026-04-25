-- Apply migrations 035, 036, and 040

-- Migration 035: Add skins_ctp_paid column
ALTER TABLE tournament_players
ADD COLUMN skins_ctp_paid TINYINT(1) NOT NULL DEFAULT 0
COMMENT 'Whether player paid optional skins/CTP fee (0 = not paid, 1 = paid)';

-- Migration 036: Add skins_ctp_fee columns and update existing fees
ALTER TABLE settings
ADD COLUMN skins_ctp_fee_18_holes DECIMAL(10,2) NOT NULL DEFAULT 10.00 COMMENT 'Optional skins/CTP fee for 18 hole events',
ADD COLUMN skins_ctp_fee_9_holes DECIMAL(10,2) NOT NULL DEFAULT 5.00 COMMENT 'Optional skins/CTP fee for 9 hole events';

-- Update existing fees to match new structure
UPDATE settings 
SET tournament_fee_18_holes = 10.00,
    tournament_fee_9_holes = 5.00,
    skins_ctp_fee_18_holes = 10.00,
    skins_ctp_fee_9_holes = 5.00
WHERE id = 1;

-- Migration 040: Add saved tournament quota snapshot to tournament_players
ALTER TABLE tournament_players
ADD COLUMN tournament_quota INT DEFAULT NULL
COMMENT 'Saved player quota used for this specific tournament';

-- Migration 041: Persist skins winners at completion
CREATE TABLE IF NOT EXISTS tournament_skin_winners (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    hole_id INT UNSIGNED NOT NULL,
    hole_number TINYINT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    prize_money DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tournament_skin_hole (tournament_id, hole_id),
    FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
    FOREIGN KEY (hole_id) REFERENCES hole(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Migration 042: Persist closest-to-pin winners at completion
CREATE TABLE IF NOT EXISTS tournament_ctp_winners (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    hole_id INT UNSIGNED NOT NULL,
    hole_number TINYINT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    ctp_feet INT UNSIGNED DEFAULT NULL,
    ctp_inches DECIMAL(3,1) DEFAULT NULL,
    ctp_image_url MEDIUMTEXT DEFAULT NULL,
    prize_money DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tournament_ctp_hole (tournament_id, hole_id),
    FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
    FOREIGN KEY (hole_id) REFERENCES hole(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Migration 043: Persist paradise points awarded per tournament
CREATE TABLE IF NOT EXISTS tournament_paradise_points (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    player_id INT UNSIGNED NOT NULL,
    place INT UNSIGNED NOT NULL,
    total_quota_points INT NOT NULL,
    player_quota INT NOT NULL,
    over_under INT NOT NULL,
    points_awarded INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tournament_player_points (tournament_id, player_id),
    KEY idx_tpp_player_id (player_id),
    FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Migration 044: Persist full pre-complete backups for restore
CREATE TABLE IF NOT EXISTS tournament_completion_backups (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    backup_data JSON NOT NULL,
    restored_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tcb_tournament_id (tournament_id),
    FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
);

-- Migration 045: Keep completion backups even if tournament rows are deleted
ALTER TABLE tournament_completion_backups
DROP FOREIGN KEY tournament_completion_backups_ibfk_1;
