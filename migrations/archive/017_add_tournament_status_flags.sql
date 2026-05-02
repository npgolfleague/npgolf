-- Add status flags to tournament table
ALTER TABLE tournament 
  ADD COLUMN in_progress TINYINT(1) DEFAULT 0 COMMENT 'Tournament is currently in progress',
  ADD COLUMN completed TINYINT(1) DEFAULT 0 COMMENT 'Tournament is completed';

-- Add index for querying tournaments by status
CREATE INDEX idx_in_progress ON tournament(in_progress);
CREATE INDEX idx_completed ON tournament(completed);
