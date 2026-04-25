-- Add golf course email to settings table for sending cart tags
ALTER TABLE settings 
ADD COLUMN golf_course_email VARCHAR(255) DEFAULT NULL AFTER tournament_fee_9_holes;
