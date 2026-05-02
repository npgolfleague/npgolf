-- Migration: Add foursome_group column to scores table
-- Date: 2025-12-05

ALTER TABLE scores ADD COLUMN foursome_group VARCHAR(50) DEFAULT NULL AFTER quota;
