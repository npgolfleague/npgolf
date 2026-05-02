-- Add quota_diff_1 column to quota table
ALTER TABLE quota ADD COLUMN quota_diff_1 INT DEFAULT NULL AFTER points_1;
