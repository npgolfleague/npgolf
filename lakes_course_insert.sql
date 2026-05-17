-- ============================================================
-- The Lakes Course — Manual Data Entry
-- Generated from scorecard image
-- Run against: npgolf database (MySQL)
-- ============================================================

-- Safety check: verify course doesn't already exist
-- SELECT id, name FROM course WHERE name = 'The Lakes Course';

-- ── Step 1: Course ────────────────────────────────────────────
INSERT INTO course (name, is_public)
VALUES ('The Lakes Course', 1);
SET @course_id = LAST_INSERT_ID();

-- ── Step 2: Holes 1-18 ───────────────────────────────────────
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  1); SET @h1  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  2); SET @h2  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  3); SET @h3  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  4); SET @h4  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  5); SET @h5  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  6); SET @h6  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  7); SET @h7  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  8); SET @h8  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id,  9); SET @h9  = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 10); SET @h10 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 11); SET @h11 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 12); SET @h12 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 13); SET @h13 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 14); SET @h14 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 15); SET @h15 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 16); SET @h16 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 17); SET @h17 = LAST_INSERT_ID();
INSERT INTO hole (course_id, hole_number) VALUES (@course_id, 18); SET @h18 = LAST_INSERT_ID();

-- ── Step 3: Tees ─────────────────────────────────────────────
INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Black', '#000000', 'M', 72.4, 138);
SET @tee_black = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 73.6, 135);
SET @tee_blue = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 71.8, 130);
SET @tee_white = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold', '#FFB300', 'M', 68.0, 123);
SET @tee_gold_m = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold (W)', '#FFB300', 'F', 73.0, 125);
SET @tee_gold_f = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 70.6, 121);
SET @tee_red = LAST_INSERT_ID();

-- ── Step 4: hole_tee records ──────────────────────────────────
-- Par (same all tees):  front 5,4,4,5,4,3,4,3,4  back 5,4,3,4,4,4,4,3,5
-- Men's HCP:            front 15,7,17,11,9,5,3,13,1  back 12,6,18,14,2,4,8,16,10
-- Ladies' HCP:          front 3,17,7,5,11,13,9,15,1  back 6,4,14,18,2,12,10,16,8

-- Black (Men)  OUT=3446  IN=3572
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_black, 495, 5, 15),
(@h2,  @tee_black, 396, 4,  7),
(@h3,  @tee_black, 393, 4, 17),
(@h4,  @tee_black, 525, 5, 11),
(@h5,  @tee_black, 376, 4,  9),
(@h6,  @tee_black, 217, 3,  5),
(@h7,  @tee_black, 421, 4,  3),
(@h8,  @tee_black, 196, 3, 13),
(@h9,  @tee_black, 427, 4,  1),
(@h10, @tee_black, 508, 5, 12),
(@h11, @tee_black, 447, 4,  6),
(@h12, @tee_black, 188, 3, 18),
(@h13, @tee_black, 371, 4, 14),
(@h14, @tee_black, 463, 4,  2),
(@h15, @tee_black, 432, 4,  4),
(@h16, @tee_black, 407, 4,  8),
(@h17, @tee_black, 231, 3, 16),
(@h18, @tee_black, 525, 5, 10);

-- Blue (Men)  OUT=3268  IN=3390
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 481, 5, 15),
(@h2,  @tee_blue, 375, 4,  7),
(@h3,  @tee_blue, 365, 4, 17),
(@h4,  @tee_blue, 483, 5, 11),
(@h5,  @tee_blue, 368, 4,  9),
(@h6,  @tee_blue, 198, 3,  5),
(@h7,  @tee_blue, 400, 4,  3),
(@h8,  @tee_blue, 185, 3, 13),
(@h9,  @tee_blue, 413, 4,  1),
(@h10, @tee_blue, 498, 5, 12),
(@h11, @tee_blue, 426, 4,  6),
(@h12, @tee_blue, 174, 3, 18),
(@h13, @tee_blue, 353, 4, 14),
(@h14, @tee_blue, 438, 4,  2),
(@h15, @tee_blue, 415, 4,  4),
(@h16, @tee_blue, 390, 4,  8),
(@h17, @tee_blue, 191, 3, 16),
(@h18, @tee_blue, 505, 5, 10);

-- White (Men)  OUT=3097  IN=3184
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 458, 5, 15),
(@h2,  @tee_white, 358, 4,  7),
(@h3,  @tee_white, 340, 4, 17),
(@h4,  @tee_white, 464, 5, 11),
(@h5,  @tee_white, 358, 4,  9),
(@h6,  @tee_white, 160, 3,  5),
(@h7,  @tee_white, 381, 4,  3),
(@h8,  @tee_white, 175, 3, 13),
(@h9,  @tee_white, 403, 4,  1),
(@h10, @tee_white, 489, 5, 12),
(@h11, @tee_white, 354, 4,  6),
(@h12, @tee_white, 168, 3, 18),
(@h13, @tee_white, 327, 4, 14),
(@h14, @tee_white, 425, 4,  2),
(@h15, @tee_white, 399, 4,  4),
(@h16, @tee_white, 379, 4,  8),
(@h17, @tee_white, 157, 3, 16),
(@h18, @tee_white, 486, 5, 10);

-- Gold (Men)  OUT=2688  IN=2832
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_m, 425, 5, 15),
(@h2,  @tee_gold_m, 340, 4,  7),
(@h3,  @tee_gold_m, 247, 4, 17),
(@h4,  @tee_gold_m, 385, 5, 11),
(@h5,  @tee_gold_m, 341, 4,  9),
(@h6,  @tee_gold_m, 120, 3,  5),
(@h7,  @tee_gold_m, 317, 4,  3),
(@h8,  @tee_gold_m, 166, 3, 13),
(@h9,  @tee_gold_m, 347, 4,  1),
(@h10, @tee_gold_m, 476, 5, 12),
(@h11, @tee_gold_m, 307, 4,  6),
(@h12, @tee_gold_m, 158, 3, 18),
(@h13, @tee_gold_m, 269, 4, 14),
(@h14, @tee_gold_m, 363, 4,  2),
(@h15, @tee_gold_m, 304, 4,  4),
(@h16, @tee_gold_m, 364, 4,  8),
(@h17, @tee_gold_m, 141, 3, 16),
(@h18, @tee_gold_m, 450, 5, 10);

-- Gold (Ladies)  OUT=2688  IN=2832  (same yardages, ladies' handicap)
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_f, 425, 5,  3),
(@h2,  @tee_gold_f, 340, 4, 17),
(@h3,  @tee_gold_f, 247, 4,  7),
(@h4,  @tee_gold_f, 385, 5,  5),
(@h5,  @tee_gold_f, 341, 4, 11),
(@h6,  @tee_gold_f, 120, 3, 13),
(@h7,  @tee_gold_f, 317, 4,  9),
(@h8,  @tee_gold_f, 166, 3, 15),
(@h9,  @tee_gold_f, 347, 4,  1),
(@h10, @tee_gold_f, 476, 5,  6),
(@h11, @tee_gold_f, 307, 4,  4),
(@h12, @tee_gold_f, 158, 3, 14),
(@h13, @tee_gold_f, 269, 4, 18),
(@h14, @tee_gold_f, 363, 4,  2),
(@h15, @tee_gold_f, 304, 4, 12),
(@h16, @tee_gold_f, 364, 4, 10),
(@h17, @tee_gold_f, 141, 3, 16),
(@h18, @tee_gold_f, 450, 5,  8);

-- Red (Ladies)  OUT=2476  IN=2612
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 406, 5,  3),
(@h2,  @tee_red, 273, 4, 17),
(@h3,  @tee_red, 241, 4,  7),
(@h4,  @tee_red, 375, 5,  5),
(@h5,  @tee_red, 289, 4, 11),
(@h6,  @tee_red, 103, 3, 13),
(@h7,  @tee_red, 311, 4,  9),
(@h8,  @tee_red, 141, 3, 15),
(@h9,  @tee_red, 337, 4,  1),
(@h10, @tee_red, 428, 5,  6),
(@h11, @tee_red, 298, 4,  4),
(@h12, @tee_red, 148, 3, 14),
(@h13, @tee_red, 246, 4, 18),
(@h14, @tee_red, 353, 4,  2),
(@h15, @tee_red, 293, 4, 12),
(@h16, @tee_red, 323, 4, 10),
(@h17, @tee_red, 126, 3, 16),
(@h18, @tee_red, 397, 5,  8);

-- ── Verify ───────────────────────────────────────────────────
-- Run after insert to confirm row counts:
-- SELECT ct.tee_name, ct.gender, ct.course_rating, ct.slope_rating, COUNT(ht.id) AS holes
-- FROM course_tee ct
-- JOIN hole_tee ht ON ht.tee_id = ct.id
-- WHERE ct.course_id = @course_id
-- GROUP BY ct.id;
