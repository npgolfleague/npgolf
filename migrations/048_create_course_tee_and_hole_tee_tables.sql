-- Migration 048: Create course_tee and hole_tee tables; add tee_id to tournament_players
-- Introduces multi-tee support. The existing hole table columns (mens_*, ladies_*)
-- are left intact until migration 050 (after scoring queries are updated).

-- Tee box definition for a course: name, color, gender, course/slope rating.
CREATE TABLE IF NOT EXISTS course_tee (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id   INT UNSIGNED NOT NULL,
  tee_name    VARCHAR(20)  NOT NULL COMMENT 'e.g. Black, Blue, White, Gold, Red',
  tee_color   VARCHAR(20)  NOT NULL DEFAULT '#FFFFFF' COMMENT 'CSS color for UI display',
  gender      ENUM('M','F','A') NOT NULL DEFAULT 'A'
              COMMENT 'M = mens only, F = ladies only, A = applicable to all',
  course_rating DECIMAL(4,1) DEFAULT NULL COMMENT 'e.g. 72.4',
  slope_rating  SMALLINT UNSIGNED DEFAULT NULL COMMENT 'e.g. 138',
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_tee (course_id, tee_name),
  KEY idx_course_id (course_id),
  CONSTRAINT fk_course_tee_course
    FOREIGN KEY (course_id) REFERENCES course (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-hole data for a specific tee: distance, par, and stroke-index handicap.
CREATE TABLE IF NOT EXISTS hole_tee (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  hole_id   INT UNSIGNED NOT NULL,
  tee_id    INT UNSIGNED NOT NULL,
  distance  INT UNSIGNED NOT NULL COMMENT 'Yards from this tee to the hole',
  par       TINYINT UNSIGNED NOT NULL COMMENT '3, 4, or 5',
  handicap  TINYINT UNSIGNED NOT NULL COMMENT 'Stroke index 1-18',
  PRIMARY KEY (id),
  UNIQUE KEY uq_hole_tee (hole_id, tee_id),
  KEY idx_hole_id (hole_id),
  KEY idx_tee_id (tee_id),
  CONSTRAINT fk_hole_tee_hole
    FOREIGN KEY (hole_id) REFERENCES hole (id) ON DELETE CASCADE,
  CONSTRAINT fk_hole_tee_tee
    FOREIGN KEY (tee_id) REFERENCES course_tee (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add tee_id to tournament_players so each player's tee is recorded per event.
ALTER TABLE tournament_players
  ADD COLUMN tee_id INT UNSIGNED DEFAULT NULL
    COMMENT 'Which tee this player plays from in this tournament (FK to course_tee)',
  ADD CONSTRAINT fk_tp_tee
    FOREIGN KEY (tee_id) REFERENCES course_tee (id) ON DELETE SET NULL;
