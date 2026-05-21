-- Migration: Add first_tee_time column to tournament table
-- Date: 2025-12-05

ALTER TABLE tournament ADD COLUMN first_tee_time TIME DEFAULT NULL AFTER date;
