-- Migration 056: Seed manually transcribed course data
-- Adds idempotent data imports for:
--   - The Forest Course
--   - The Lakes Course
--   - Westchase Golf Club
--   - Heritage Harbor Golf & Country Club

-- -----------------------------------------------------------------------------
-- The Forest Course
-- -----------------------------------------------------------------------------
INSERT INTO course (name, is_public)
SELECT 'The Forest Course', 1
WHERE NOT EXISTS (
  SELECT 1 FROM course WHERE name = 'The Forest Course'
);

SET @course_id = (SELECT id FROM course WHERE name = 'The Forest Course' LIMIT 1);
UPDATE course SET is_public = 1 WHERE id = @course_id;

INSERT IGNORE INTO hole (course_id, hole_number) VALUES
(@course_id, 1), (@course_id, 2), (@course_id, 3), (@course_id, 4), (@course_id, 5), (@course_id, 6),
(@course_id, 7), (@course_id, 8), (@course_id, 9), (@course_id, 10), (@course_id, 11), (@course_id, 12),
(@course_id, 13), (@course_id, 14), (@course_id, 15), (@course_id, 16), (@course_id, 17), (@course_id, 18);

SET @h1  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 1 LIMIT 1);
SET @h2  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 2 LIMIT 1);
SET @h3  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 3 LIMIT 1);
SET @h4  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 4 LIMIT 1);
SET @h5  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 5 LIMIT 1);
SET @h6  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 6 LIMIT 1);
SET @h7  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 7 LIMIT 1);
SET @h8  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 8 LIMIT 1);
SET @h9  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 9 LIMIT 1);
SET @h10 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 10 LIMIT 1);
SET @h11 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 11 LIMIT 1);
SET @h12 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 12 LIMIT 1);
SET @h13 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 13 LIMIT 1);
SET @h14 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 14 LIMIT 1);
SET @h15 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 15 LIMIT 1);
SET @h16 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 16 LIMIT 1);
SET @h17 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 17 LIMIT 1);
SET @h18 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 18 LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Black', '#000000', 'M', 72.7, 134)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_black = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Black' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 70.8, 127)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_blue = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Blue' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 68.4, 118)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_white = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'White' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold', '#FFB300', 'M', 66.9, 112)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_gold_m = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Gold' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold (W)', '#FFB300', 'F', 71.9, 125)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_gold_f = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Gold (W)' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 69.5, 114)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_red = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Red' LIMIT 1);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_black, 488, 5,  9), (@h2,  @tee_black, 377, 4, 11), (@h3,  @tee_black, 315, 4, 15),
(@h4,  @tee_black, 143, 3, 17), (@h5,  @tee_black, 437, 4,  1), (@h6,  @tee_black, 155, 3, 13),
(@h7,  @tee_black, 508, 5,  5), (@h8,  @tee_black, 400, 4,  7), (@h9,  @tee_black, 405, 4,  3),
(@h10, @tee_black, 470, 5, 18), (@h11, @tee_black, 391, 4, 16), (@h12, @tee_black, 228, 3,  8),
(@h13, @tee_black, 426, 4,  2), (@h14, @tee_black, 379, 4,  6), (@h15, @tee_black, 367, 4, 10),
(@h16, @tee_black, 193, 3, 12), (@h17, @tee_black, 528, 5, 14), (@h18, @tee_black, 394, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 461, 5,  9), (@h2,  @tee_blue, 355, 4, 11), (@h3,  @tee_blue, 303, 4, 15),
(@h4,  @tee_blue, 130, 3, 17), (@h5,  @tee_blue, 412, 4,  1), (@h6,  @tee_blue, 135, 3, 13),
(@h7,  @tee_blue, 479, 5,  5), (@h8,  @tee_blue, 378, 4,  7), (@h9,  @tee_blue, 363, 4,  3),
(@h10, @tee_blue, 442, 5, 18), (@h11, @tee_blue, 360, 4, 16), (@h12, @tee_blue, 200, 3,  8),
(@h13, @tee_blue, 415, 4,  2), (@h14, @tee_blue, 359, 4,  6), (@h15, @tee_blue, 329, 4, 10),
(@h16, @tee_blue, 174, 3, 12), (@h17, @tee_blue, 504, 5, 14), (@h18, @tee_blue, 353, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 451, 5,  9), (@h2,  @tee_white, 335, 4, 11), (@h3,  @tee_white, 269, 4, 15),
(@h4,  @tee_white, 115, 3, 17), (@h5,  @tee_white, 379, 4,  1), (@h6,  @tee_white, 127, 3, 13),
(@h7,  @tee_white, 457, 5,  5), (@h8,  @tee_white, 315, 4,  7), (@h9,  @tee_white, 333, 4,  3),
(@h10, @tee_white, 405, 5, 18), (@h11, @tee_white, 306, 4, 16), (@h12, @tee_white, 158, 3,  8),
(@h13, @tee_white, 378, 4,  2), (@h14, @tee_white, 332, 4,  6), (@h15, @tee_white, 293, 4, 10),
(@h16, @tee_white, 149, 3, 12), (@h17, @tee_white, 476, 5, 14), (@h18, @tee_white, 316, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_m, 438, 5,  9), (@h2,  @tee_gold_m, 319, 4, 11), (@h3,  @tee_gold_m, 249, 4, 15),
(@h4,  @tee_gold_m, 103, 3, 17), (@h5,  @tee_gold_m, 369, 4,  1), (@h6,  @tee_gold_m, 114, 3, 13),
(@h7,  @tee_gold_m, 447, 5,  5), (@h8,  @tee_gold_m, 305, 4,  7), (@h9,  @tee_gold_m, 323, 4,  3),
(@h10, @tee_gold_m, 385, 5, 18), (@h11, @tee_gold_m, 296, 4, 16), (@h12, @tee_gold_m, 125, 3,  8),
(@h13, @tee_gold_m, 349, 4,  2), (@h14, @tee_gold_m, 309, 4,  6), (@h15, @tee_gold_m, 228, 4, 10),
(@h16, @tee_gold_m, 149, 3, 12), (@h17, @tee_gold_m, 439, 5, 14), (@h18, @tee_gold_m, 306, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_f, 438, 5,  3), (@h2,  @tee_gold_f, 319, 4, 11), (@h3,  @tee_gold_f, 249, 4, 13),
(@h4,  @tee_gold_f, 103, 3, 17), (@h5,  @tee_gold_f, 369, 4,  1), (@h6,  @tee_gold_f, 114, 3, 15),
(@h7,  @tee_gold_f, 447, 5,  5), (@h8,  @tee_gold_f, 305, 4,  9), (@h9,  @tee_gold_f, 323, 4,  7),
(@h10, @tee_gold_f, 385, 5,  6), (@h11, @tee_gold_f, 296, 4, 14), (@h12, @tee_gold_f, 125, 3, 16),
(@h13, @tee_gold_f, 349, 4,  2), (@h14, @tee_gold_f, 309, 4,  8), (@h15, @tee_gold_f, 228, 4, 12),
(@h16, @tee_gold_f, 149, 3, 18), (@h17, @tee_gold_f, 439, 5,  4), (@h18, @tee_gold_f, 306, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 416, 5,  3), (@h2,  @tee_red, 297, 4, 11), (@h3,  @tee_red, 190, 4, 13),
(@h4,  @tee_red,  79, 3, 17), (@h5,  @tee_red, 320, 4,  1), (@h6,  @tee_red, 100, 3, 15),
(@h7,  @tee_red, 417, 5,  5), (@h8,  @tee_red, 288, 4,  9), (@h9,  @tee_red, 310, 4,  7),
(@h10, @tee_red, 375, 5,  6), (@h11, @tee_red, 264, 4, 14), (@h12, @tee_red, 115, 3, 16),
(@h13, @tee_red, 307, 4,  2), (@h14, @tee_red, 281, 4,  8), (@h15, @tee_red, 236, 4, 12),
(@h16, @tee_red, 107, 3, 18), (@h17, @tee_red, 382, 5,  4), (@h18, @tee_red, 284, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

-- -----------------------------------------------------------------------------
-- The Lakes Course
-- -----------------------------------------------------------------------------
INSERT INTO course (name, is_public)
SELECT 'The Lakes Course', 1
WHERE NOT EXISTS (
  SELECT 1 FROM course WHERE name = 'The Lakes Course'
);

SET @course_id = (SELECT id FROM course WHERE name = 'The Lakes Course' LIMIT 1);
UPDATE course SET is_public = 1 WHERE id = @course_id;

INSERT IGNORE INTO hole (course_id, hole_number) VALUES
(@course_id, 1), (@course_id, 2), (@course_id, 3), (@course_id, 4), (@course_id, 5), (@course_id, 6),
(@course_id, 7), (@course_id, 8), (@course_id, 9), (@course_id, 10), (@course_id, 11), (@course_id, 12),
(@course_id, 13), (@course_id, 14), (@course_id, 15), (@course_id, 16), (@course_id, 17), (@course_id, 18);

SET @h1  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 1 LIMIT 1);
SET @h2  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 2 LIMIT 1);
SET @h3  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 3 LIMIT 1);
SET @h4  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 4 LIMIT 1);
SET @h5  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 5 LIMIT 1);
SET @h6  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 6 LIMIT 1);
SET @h7  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 7 LIMIT 1);
SET @h8  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 8 LIMIT 1);
SET @h9  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 9 LIMIT 1);
SET @h10 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 10 LIMIT 1);
SET @h11 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 11 LIMIT 1);
SET @h12 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 12 LIMIT 1);
SET @h13 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 13 LIMIT 1);
SET @h14 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 14 LIMIT 1);
SET @h15 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 15 LIMIT 1);
SET @h16 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 16 LIMIT 1);
SET @h17 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 17 LIMIT 1);
SET @h18 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 18 LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Black', '#000000', 'M', 72.4, 138)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_black = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Black' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 73.6, 135)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_blue = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Blue' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 71.8, 130)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_white = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'White' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold', '#FFB300', 'M', 68.0, 123)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_gold_m = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Gold' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold (W)', '#FFB300', 'F', 73.0, 125)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_gold_f = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Gold (W)' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 70.6, 121)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_red = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Red' LIMIT 1);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_black, 495, 5, 15), (@h2,  @tee_black, 396, 4,  7), (@h3,  @tee_black, 393, 4, 17),
(@h4,  @tee_black, 525, 5, 11), (@h5,  @tee_black, 376, 4,  9), (@h6,  @tee_black, 217, 3,  5),
(@h7,  @tee_black, 421, 4,  3), (@h8,  @tee_black, 196, 3, 13), (@h9,  @tee_black, 427, 4,  1),
(@h10, @tee_black, 508, 5, 12), (@h11, @tee_black, 447, 4,  6), (@h12, @tee_black, 188, 3, 18),
(@h13, @tee_black, 371, 4, 14), (@h14, @tee_black, 463, 4,  2), (@h15, @tee_black, 432, 4,  4),
(@h16, @tee_black, 407, 4,  8), (@h17, @tee_black, 231, 3, 16), (@h18, @tee_black, 525, 5, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 481, 5, 15), (@h2,  @tee_blue, 375, 4,  7), (@h3,  @tee_blue, 365, 4, 17),
(@h4,  @tee_blue, 483, 5, 11), (@h5,  @tee_blue, 368, 4,  9), (@h6,  @tee_blue, 198, 3,  5),
(@h7,  @tee_blue, 400, 4,  3), (@h8,  @tee_blue, 185, 3, 13), (@h9,  @tee_blue, 413, 4,  1),
(@h10, @tee_blue, 498, 5, 12), (@h11, @tee_blue, 426, 4,  6), (@h12, @tee_blue, 174, 3, 18),
(@h13, @tee_blue, 353, 4, 14), (@h14, @tee_blue, 438, 4,  2), (@h15, @tee_blue, 415, 4,  4),
(@h16, @tee_blue, 390, 4,  8), (@h17, @tee_blue, 191, 3, 16), (@h18, @tee_blue, 505, 5, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 458, 5, 15), (@h2,  @tee_white, 358, 4,  7), (@h3,  @tee_white, 340, 4, 17),
(@h4,  @tee_white, 464, 5, 11), (@h5,  @tee_white, 358, 4,  9), (@h6,  @tee_white, 160, 3,  5),
(@h7,  @tee_white, 381, 4,  3), (@h8,  @tee_white, 175, 3, 13), (@h9,  @tee_white, 403, 4,  1),
(@h10, @tee_white, 489, 5, 12), (@h11, @tee_white, 354, 4,  6), (@h12, @tee_white, 168, 3, 18),
(@h13, @tee_white, 327, 4, 14), (@h14, @tee_white, 425, 4,  2), (@h15, @tee_white, 399, 4,  4),
(@h16, @tee_white, 379, 4,  8), (@h17, @tee_white, 157, 3, 16), (@h18, @tee_white, 486, 5, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_m, 425, 5, 15), (@h2,  @tee_gold_m, 340, 4,  7), (@h3,  @tee_gold_m, 247, 4, 17),
(@h4,  @tee_gold_m, 385, 5, 11), (@h5,  @tee_gold_m, 341, 4,  9), (@h6,  @tee_gold_m, 120, 3,  5),
(@h7,  @tee_gold_m, 317, 4,  3), (@h8,  @tee_gold_m, 166, 3, 13), (@h9,  @tee_gold_m, 347, 4,  1),
(@h10, @tee_gold_m, 476, 5, 12), (@h11, @tee_gold_m, 307, 4,  6), (@h12, @tee_gold_m, 158, 3, 18),
(@h13, @tee_gold_m, 269, 4, 14), (@h14, @tee_gold_m, 363, 4,  2), (@h15, @tee_gold_m, 304, 4,  4),
(@h16, @tee_gold_m, 364, 4,  8), (@h17, @tee_gold_m, 141, 3, 16), (@h18, @tee_gold_m, 450, 5, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_f, 425, 5,  3), (@h2,  @tee_gold_f, 340, 4, 17), (@h3,  @tee_gold_f, 247, 4,  7),
(@h4,  @tee_gold_f, 385, 5,  5), (@h5,  @tee_gold_f, 341, 4, 11), (@h6,  @tee_gold_f, 120, 3, 13),
(@h7,  @tee_gold_f, 317, 4,  9), (@h8,  @tee_gold_f, 166, 3, 15), (@h9,  @tee_gold_f, 347, 4,  1),
(@h10, @tee_gold_f, 476, 5,  6), (@h11, @tee_gold_f, 307, 4,  4), (@h12, @tee_gold_f, 158, 3, 14),
(@h13, @tee_gold_f, 269, 4, 18), (@h14, @tee_gold_f, 363, 4,  2), (@h15, @tee_gold_f, 304, 4, 12),
(@h16, @tee_gold_f, 364, 4, 10), (@h17, @tee_gold_f, 141, 3, 16), (@h18, @tee_gold_f, 450, 5,  8)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 406, 5,  3), (@h2,  @tee_red, 273, 4, 17), (@h3,  @tee_red, 241, 4,  7),
(@h4,  @tee_red, 375, 5,  5), (@h5,  @tee_red, 289, 4, 11), (@h6,  @tee_red, 103, 3, 13),
(@h7,  @tee_red, 311, 4,  9), (@h8,  @tee_red, 141, 3, 15), (@h9,  @tee_red, 337, 4,  1),
(@h10, @tee_red, 428, 5,  6), (@h11, @tee_red, 298, 4,  4), (@h12, @tee_red, 148, 3, 14),
(@h13, @tee_red, 246, 4, 18), (@h14, @tee_red, 353, 4,  2), (@h15, @tee_red, 293, 4, 12),
(@h16, @tee_red, 323, 4, 10), (@h17, @tee_red, 126, 3, 16), (@h18, @tee_red, 397, 5,  8)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

-- -----------------------------------------------------------------------------
-- Westchase Golf Club
-- -----------------------------------------------------------------------------
INSERT INTO course (name, is_public)
SELECT 'Westchase Golf Club', 1
WHERE NOT EXISTS (
  SELECT 1 FROM course WHERE name = 'Westchase Golf Club'
);

SET @course_id = (SELECT id FROM course WHERE name = 'Westchase Golf Club' LIMIT 1);
UPDATE course SET is_public = 1 WHERE id = @course_id;

INSERT IGNORE INTO hole (course_id, hole_number) VALUES
(@course_id, 1), (@course_id, 2), (@course_id, 3), (@course_id, 4), (@course_id, 5), (@course_id, 6),
(@course_id, 7), (@course_id, 8), (@course_id, 9), (@course_id, 10), (@course_id, 11), (@course_id, 12),
(@course_id, 13), (@course_id, 14), (@course_id, 15), (@course_id, 16), (@course_id, 17), (@course_id, 18);

SET @h1  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 1 LIMIT 1);
SET @h2  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 2 LIMIT 1);
SET @h3  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 3 LIMIT 1);
SET @h4  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 4 LIMIT 1);
SET @h5  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 5 LIMIT 1);
SET @h6  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 6 LIMIT 1);
SET @h7  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 7 LIMIT 1);
SET @h8  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 8 LIMIT 1);
SET @h9  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 9 LIMIT 1);
SET @h10 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 10 LIMIT 1);
SET @h11 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 11 LIMIT 1);
SET @h12 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 12 LIMIT 1);
SET @h13 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 13 LIMIT 1);
SET @h14 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 14 LIMIT 1);
SET @h15 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 15 LIMIT 1);
SET @h16 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 16 LIMIT 1);
SET @h17 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 17 LIMIT 1);
SET @h18 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 18 LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Championship', '#0066CC', 'M', 72.1, 136)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_champ = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Championship' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Clifton', '#ffffff', 'M', 69.6, 130)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_clifton = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Clifton' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue/White Combo', '#ADD8E6', 'M', NULL, NULL)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_bwcombo = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Blue/White Combo' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White/Green Combo', '#90EE90', 'M', NULL, NULL)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_wgcombo = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'White/Green Combo' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Club', '#009900', 'M', 67.5, 122)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_club = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Club' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Forward', '#CC0000', 'F', 67.0, 128)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_forward = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Forward' LIMIT 1);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_champ, 326, 4, 13), (@h2,  @tee_champ, 532, 5,  5), (@h3,  @tee_champ, 205, 3,  9),
(@h4,  @tee_champ, 368, 4, 15), (@h5,  @tee_champ, 416, 4,  1), (@h6,  @tee_champ, 409, 4,  7),
(@h7,  @tee_champ, 160, 3, 17), (@h8,  @tee_champ, 513, 5, 11), (@h9,  @tee_champ, 402, 4,  3),
(@h10, @tee_champ, 499, 5,  6), (@h11, @tee_champ, 185, 3, 14), (@h12, @tee_champ, 359, 4,  8),
(@h13, @tee_champ, 493, 5, 16), (@h14, @tee_champ, 352, 4, 12), (@h15, @tee_champ, 152, 3, 18),
(@h16, @tee_champ, 342, 4,  4), (@h17, @tee_champ, 394, 4,  2), (@h18, @tee_champ, 380, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_bwcombo, 326, 4, 13), (@h2,  @tee_bwcombo, 508, 5,  5), (@h3,  @tee_bwcombo, 177, 3,  9),
(@h4,  @tee_bwcombo, 368, 4, 15), (@h5,  @tee_bwcombo, 391, 4,  1), (@h6,  @tee_bwcombo, 376, 4,  7),
(@h7,  @tee_bwcombo, 160, 3, 17), (@h8,  @tee_bwcombo, 486, 5, 11), (@h9,  @tee_bwcombo, 373, 4,  3),
(@h10, @tee_bwcombo, 472, 5,  6), (@h11, @tee_bwcombo, 166, 3, 14), (@h12, @tee_bwcombo, 359, 4,  8),
(@h13, @tee_bwcombo, 493, 5, 16), (@h14, @tee_bwcombo, 352, 4, 12), (@h15, @tee_bwcombo, 152, 3, 18),
(@h16, @tee_bwcombo, 308, 4,  4), (@h17, @tee_bwcombo, 367, 4,  2), (@h18, @tee_bwcombo, 380, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_clifton, 297, 4, 13), (@h2,  @tee_clifton, 508, 5,  5), (@h3,  @tee_clifton, 177, 3,  9),
(@h4,  @tee_clifton, 336, 4, 15), (@h5,  @tee_clifton, 391, 4,  1), (@h6,  @tee_clifton, 376, 4,  7),
(@h7,  @tee_clifton, 123, 3, 17), (@h8,  @tee_clifton, 486, 5, 11), (@h9,  @tee_clifton, 373, 4,  3),
(@h10, @tee_clifton, 472, 5,  6), (@h11, @tee_clifton, 166, 3, 14), (@h12, @tee_clifton, 334, 4,  8),
(@h13, @tee_clifton, 446, 5, 16), (@h14, @tee_clifton, 291, 4, 12), (@h15, @tee_clifton, 125, 3, 18),
(@h16, @tee_clifton, 308, 4,  4), (@h17, @tee_clifton, 367, 4,  2), (@h18, @tee_clifton, 347, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_wgcombo, 297, 4, 13), (@h2,  @tee_wgcombo, 494, 5,  3), (@h3,  @tee_wgcombo, 117, 3, 11),
(@h4,  @tee_wgcombo, 336, 4, 15), (@h5,  @tee_wgcombo, 391, 4,  9), (@h6,  @tee_wgcombo, 352, 4,  5),
(@h7,  @tee_wgcombo, 123, 3, 17), (@h8,  @tee_wgcombo, 458, 5,  7), (@h9,  @tee_wgcombo, 373, 4,  1),
(@h10, @tee_wgcombo, 472, 5,  2), (@h11, @tee_wgcombo, 144, 3, 16), (@h12, @tee_wgcombo, 334, 4, 12),
(@h13, @tee_wgcombo, 446, 5,  6), (@h14, @tee_wgcombo, 291, 4, 14), (@h15, @tee_wgcombo, 125, 3, 18),
(@h16, @tee_wgcombo, 308, 4, 10), (@h17, @tee_wgcombo, 349, 4,  8), (@h18, @tee_wgcombo, 347, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_club, 253, 4, 13), (@h2,  @tee_club, 494, 5,  5), (@h3,  @tee_club, 117, 3,  9),
(@h4,  @tee_club, 254, 4, 15), (@h5,  @tee_club, 365, 4,  1), (@h6,  @tee_club, 352, 4,  7),
(@h7,  @tee_club,  96, 3, 17), (@h8,  @tee_club, 458, 5, 11), (@h9,  @tee_club, 347, 4,  3),
(@h10, @tee_club, 459, 5,  6), (@h11, @tee_club, 144, 3, 14), (@h12, @tee_club, 319, 4,  8),
(@h13, @tee_club, 430, 5, 16), (@h14, @tee_club, 274, 4, 12), (@h15, @tee_club, 125, 3, 18),
(@h16, @tee_club, 296, 4,  4), (@h17, @tee_club, 349, 4,  2), (@h18, @tee_club, 333, 4, 10)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_forward, 227, 4, 13), (@h2,  @tee_forward, 425, 5,  3), (@h3,  @tee_forward,  77, 3, 11),
(@h4,  @tee_forward, 254, 4, 15), (@h5,  @tee_forward, 303, 4,  9), (@h6,  @tee_forward, 261, 4,  5),
(@h7,  @tee_forward,  80, 3, 17), (@h8,  @tee_forward, 389, 5,  7), (@h9,  @tee_forward, 289, 4,  1),
(@h10, @tee_forward, 408, 5,  2), (@h11, @tee_forward,  79, 3, 16), (@h12, @tee_forward, 227, 4, 12),
(@h13, @tee_forward, 405, 5,  6), (@h14, @tee_forward, 240, 4, 14), (@h15, @tee_forward, 102, 3, 18),
(@h16, @tee_forward, 237, 4, 10), (@h17, @tee_forward, 274, 4,  8), (@h18, @tee_forward, 239, 4,  4)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

-- -----------------------------------------------------------------------------
-- Heritage Harbor Golf & Country Club
-- -----------------------------------------------------------------------------
INSERT INTO course (name, address, phone, is_public)
SELECT 'Heritage Harbor Golf & Country Club', '19502 Heritage Harbor Parkway, Lutz, FL 33558', '813-949-4886', 1
WHERE NOT EXISTS (
  SELECT 1 FROM course WHERE name = 'Heritage Harbor Golf & Country Club'
);

SET @course_id = (SELECT id FROM course WHERE name = 'Heritage Harbor Golf & Country Club' LIMIT 1);
UPDATE course
SET address = '19502 Heritage Harbor Parkway, Lutz, FL 33558',
    phone = '813-949-4886',
    is_public = 1
WHERE id = @course_id;

INSERT IGNORE INTO hole (course_id, hole_number) VALUES
(@course_id, 1), (@course_id, 2), (@course_id, 3), (@course_id, 4), (@course_id, 5), (@course_id, 6),
(@course_id, 7), (@course_id, 8), (@course_id, 9), (@course_id, 10), (@course_id, 11), (@course_id, 12),
(@course_id, 13), (@course_id, 14), (@course_id, 15), (@course_id, 16), (@course_id, 17), (@course_id, 18);

SET @h1  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 1 LIMIT 1);
SET @h2  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 2 LIMIT 1);
SET @h3  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 3 LIMIT 1);
SET @h4  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 4 LIMIT 1);
SET @h5  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 5 LIMIT 1);
SET @h6  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 6 LIMIT 1);
SET @h7  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 7 LIMIT 1);
SET @h8  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 8 LIMIT 1);
SET @h9  = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 9 LIMIT 1);
SET @h10 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 10 LIMIT 1);
SET @h11 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 11 LIMIT 1);
SET @h12 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 12 LIMIT 1);
SET @h13 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 13 LIMIT 1);
SET @h14 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 14 LIMIT 1);
SET @h15 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 15 LIMIT 1);
SET @h16 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 16 LIMIT 1);
SET @h17 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 17 LIMIT 1);
SET @h18 = (SELECT id FROM hole WHERE course_id = @course_id AND hole_number = 18 LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold', '#FFB300', 'M', 73.5, 129)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_gold = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Gold' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 69.4, 117)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_blue = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Blue' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 66.9, 109)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_white = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'White' LIMIT 1);

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 68.2, 116)
ON DUPLICATE KEY UPDATE tee_color = VALUES(tee_color), gender = VALUES(gender), course_rating = VALUES(course_rating), slope_rating = VALUES(slope_rating);
SET @tee_red = (SELECT id FROM course_tee WHERE course_id = @course_id AND tee_name = 'Red' LIMIT 1);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold, 346, 4, 12), (@h2,  @tee_gold, 300, 4, 14), (@h3,  @tee_gold, 181, 3, 18),
(@h4,  @tee_gold, 422, 4,  6), (@h5,  @tee_gold, 519, 5,  4), (@h6,  @tee_gold, 412, 4,  8),
(@h7,  @tee_gold, 213, 3, 16), (@h8,  @tee_gold, 557, 5,  2), (@h9,  @tee_gold, 373, 4, 10),
(@h10, @tee_gold, 556, 5,  3), (@h11, @tee_gold, 387, 4, 11), (@h12, @tee_gold, 417, 4,  5),
(@h13, @tee_gold, 415, 4,  7), (@h14, @tee_gold, 263, 3, 15), (@h15, @tee_gold, 577, 5,  1),
(@h16, @tee_gold, 176, 3, 17), (@h17, @tee_gold, 406, 4, 13), (@h18, @tee_gold, 378, 4,  9)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 306, 4, 12), (@h2,  @tee_blue, 287, 4, 14), (@h3,  @tee_blue, 150, 3, 18),
(@h4,  @tee_blue, 394, 4,  6), (@h5,  @tee_blue, 463, 5,  4), (@h6,  @tee_blue, 395, 4,  8),
(@h7,  @tee_blue, 177, 3, 16), (@h8,  @tee_blue, 496, 5,  2), (@h9,  @tee_blue, 344, 4, 10),
(@h10, @tee_blue, 537, 5,  3), (@h11, @tee_blue, 339, 4, 11), (@h12, @tee_blue, 323, 4,  5),
(@h13, @tee_blue, 355, 4,  7), (@h14, @tee_blue, 131, 3, 15), (@h15, @tee_blue, 533, 5,  1),
(@h16, @tee_blue, 143, 3, 17), (@h17, @tee_blue, 349, 4, 13), (@h18, @tee_blue, 331, 4,  9)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 286, 4, 12), (@h2,  @tee_white, 250, 4, 14), (@h3,  @tee_white, 137, 3, 18),
(@h4,  @tee_white, 292, 4,  6), (@h5,  @tee_white, 445, 5,  4), (@h6,  @tee_white, 352, 4,  8),
(@h7,  @tee_white, 169, 3, 16), (@h8,  @tee_white, 458, 5,  2), (@h9,  @tee_white, 313, 4, 10),
(@h10, @tee_white, 482, 5,  3), (@h11, @tee_white, 309, 4, 11), (@h12, @tee_white, 295, 4,  5),
(@h13, @tee_white, 319, 4,  7), (@h14, @tee_white, 118, 3, 15), (@h15, @tee_white, 505, 5,  1),
(@h16, @tee_white, 127, 3, 17), (@h17, @tee_white, 317, 4, 13), (@h18, @tee_white, 313, 4,  9)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);

INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 250, 4, 12), (@h2,  @tee_red, 236, 4, 14), (@h3,  @tee_red,  90, 3, 18),
(@h4,  @tee_red, 282, 4,  6), (@h5,  @tee_red, 379, 5,  4), (@h6,  @tee_red, 306, 4,  8),
(@h7,  @tee_red, 125, 3, 16), (@h8,  @tee_red, 398, 5,  2), (@h9,  @tee_red, 263, 4, 10),
(@h10, @tee_red, 428, 5,  3), (@h11, @tee_red, 253, 4, 11), (@h12, @tee_red, 264, 4,  5),
(@h13, @tee_red, 280, 4,  7), (@h14, @tee_red, 104, 3, 15), (@h15, @tee_red, 468, 5,  1),
(@h16, @tee_red,  90, 3, 17), (@h17, @tee_red, 282, 4, 13), (@h18, @tee_red, 275, 4,  9)
ON DUPLICATE KEY UPDATE distance = VALUES(distance), par = VALUES(par), handicap = VALUES(handicap);