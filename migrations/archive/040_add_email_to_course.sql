-- Add email column to course table for receiving cart tags and communications
ALTER TABLE course 
ADD COLUMN email VARCHAR(255) AFTER phone;
