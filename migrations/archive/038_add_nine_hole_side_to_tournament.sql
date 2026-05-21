-- Add front/back side selection for 9-hole tournaments
ALTER TABLE tournament
  ADD COLUMN nine_hole_side ENUM('front', 'back') NOT NULL DEFAULT 'front';
