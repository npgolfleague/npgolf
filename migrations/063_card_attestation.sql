-- ============================================================================
-- Migration 063: Marker signs the card (card attestation)
-- Date: 2026-11-14
--
--   * league_settings.require_card_attest: when on, a posted card must be
--     signed by a player from the other pair in the foursome before it counts.
--     Off by default, so nothing changes until a league turns it on.
--   * foursome_posts gets the sign-off state:
--       status       posted          - card is final (signed, or signing is off)
--                    awaiting_marker - submitted, waiting for the marker to sign
--                    disputed        - the marker flagged a problem for an admin
--       attested_by / attested_at       - who signed and when
--       dispute_note / disputed_by / _at - what the marker flagged
--     Existing posts become 'posted'. Any row still locks the card's scores.
--
-- Idempotent: safe to re-run.
-- ============================================================================

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE league_settings ADD COLUMN require_card_attest TINYINT(1) NOT NULL DEFAULT 0 AFTER live_scoring',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'league_settings' AND COLUMN_NAME = 'require_card_attest');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  "ALTER TABLE foursome_posts
     ADD COLUMN status ENUM('posted', 'awaiting_marker', 'disputed') NOT NULL DEFAULT 'posted' AFTER posted_by,
     ADD COLUMN attested_by INT UNSIGNED NULL AFTER status,
     ADD COLUMN attested_at DATETIME NULL AFTER attested_by,
     ADD COLUMN dispute_note VARCHAR(500) NULL AFTER attested_at,
     ADD COLUMN disputed_by INT UNSIGNED NULL AFTER dispute_note,
     ADD COLUMN disputed_at DATETIME NULL AFTER disputed_by",
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'foursome_posts' AND COLUMN_NAME = 'status');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foursome_posts ADD CONSTRAINT fk_fp_attested_by FOREIGN KEY (attested_by) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'foursome_posts' AND CONSTRAINT_NAME = 'fk_fp_attested_by');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foursome_posts ADD CONSTRAINT fk_fp_disputed_by FOREIGN KEY (disputed_by) REFERENCES players (id) ON DELETE SET NULL',
  'SELECT 1')
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'foursome_posts' AND CONSTRAINT_NAME = 'fk_fp_disputed_by');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
