-- Add quota_diff fields to quota table (one for each date/points pair)
ALTER TABLE quota 
  ADD COLUMN quota_diff_1 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_2 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_3 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_4 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_5 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_6 DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN quota_diff_7 DECIMAL(5,2) DEFAULT NULL;
