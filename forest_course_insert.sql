-- ============================================================
-- The Forest Course — Manual Data Entry
-- Generated from scorecard image
-- Run against: npgolf database (MySQL)
--
-- Tee adjustments made to match printed OUT/IN totals:
--   Blue  H9 : read 378, corrected to 363 (OUT 3016 ✓)
--   White H8 : read 333, corrected to 315 (OUT 2781 ✓)
--   Gold  H8 : read 323, corrected to 305 (OUT 2667 ✓)
--   Gold  H15: read 149, corrected to 228 (IN  2586 ✓)
-- ============================================================

-- Safety check (uncomment to verify before running):
-- SELECT id, name FROM course WHERE name = 'The Forest Course';

-- ── Step 1: Course ────────────────────────────────────────────
INSERT INTO course (name, is_public)
VALUES ('The Forest Course', 1);
SET @course_id = LAST_INSERT_ID();

-- ── Step 2: Holes 1–18 ───────────────────────────────────────
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
VALUES (@course_id, 'Black', '#000000', 'M', 72.7, 134);
SET @tee_black = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 70.8, 127);
SET @tee_blue = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 68.4, 118);
SET @tee_white = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold', '#FFB300', 'M', 66.9, 112);
SET @tee_gold_m = LAST_INSERT_ID();

-- Gold Women uses same yardages, different rating/slope
INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Gold (W)', '#FFB300', 'F', 71.9, 125);
SET @tee_gold_f = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 69.5, 114);
SET @tee_red = LAST_INSERT_ID();

-- ── Step 4: hole_tee records ──────────────────────────────────
-- Par (same all tees):  front  5, 4, 4, 3, 4, 3, 5, 4, 4  (OUT 36)
--                       back   5, 4, 3, 4, 4, 4, 3, 5, 4  (IN  36)  TOT 72
-- Men's  HCP:           front  9,11,15,17, 1,13, 5, 7, 3
--                       back  18,16, 8, 2, 6,10,12,14, 4
-- Ladies HCP:           front  3,11,13,17, 1,15, 5, 9, 7
--                       back   6,14,16, 2, 8,12,18, 4,10

-- ── Black (Men)  OUT=3228  IN=3376  TOT=6604 ──────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_black, 488, 5,  9),
(@h2,  @tee_black, 377, 4, 11),
(@h3,  @tee_black, 315, 4, 15),
(@h4,  @tee_black, 143, 3, 17),
(@h5,  @tee_black, 437, 4,  1),
(@h6,  @tee_black, 155, 3, 13),
(@h7,  @tee_black, 508, 5,  5),
(@h8,  @tee_black, 400, 4,  7),
(@h9,  @tee_black, 405, 4,  3),
(@h10, @tee_black, 470, 5, 18),
(@h11, @tee_black, 391, 4, 16),
(@h12, @tee_black, 228, 3,  8),
(@h13, @tee_black, 426, 4,  2),
(@h14, @tee_black, 379, 4,  6),
(@h15, @tee_black, 367, 4, 10),
(@h16, @tee_black, 193, 3, 12),
(@h17, @tee_black, 528, 5, 14),
(@h18, @tee_black, 394, 4,  4);

-- ── Blue (Men)  OUT=3016  IN=3136  TOT=6152 ───────────────────
-- Note: H9 printed as 378 but corrected to 363 to match OUT=3016
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 461, 5,  9),
(@h2,  @tee_blue, 355, 4, 11),
(@h3,  @tee_blue, 303, 4, 15),
(@h4,  @tee_blue, 130, 3, 17),
(@h5,  @tee_blue, 412, 4,  1),
(@h6,  @tee_blue, 135, 3, 13),
(@h7,  @tee_blue, 479, 5,  5),
(@h8,  @tee_blue, 378, 4,  7),
(@h9,  @tee_blue, 363, 4,  3),
(@h10, @tee_blue, 442, 5, 18),
(@h11, @tee_blue, 360, 4, 16),
(@h12, @tee_blue, 200, 3,  8),
(@h13, @tee_blue, 415, 4,  2),
(@h14, @tee_blue, 359, 4,  6),
(@h15, @tee_blue, 329, 4, 10),
(@h16, @tee_blue, 174, 3, 12),
(@h17, @tee_blue, 504, 5, 14),
(@h18, @tee_blue, 353, 4,  4);

-- ── White (Men)  OUT=2781  IN=2813  TOT=5594 ──────────────────
-- Note: H8 printed as 333 but corrected to 315 to match OUT=2781
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 451, 5,  9),
(@h2,  @tee_white, 335, 4, 11),
(@h3,  @tee_white, 269, 4, 15),
(@h4,  @tee_white, 115, 3, 17),
(@h5,  @tee_white, 379, 4,  1),
(@h6,  @tee_white, 127, 3, 13),
(@h7,  @tee_white, 457, 5,  5),
(@h8,  @tee_white, 315, 4,  7),
(@h9,  @tee_white, 333, 4,  3),
(@h10, @tee_white, 405, 5, 18),
(@h11, @tee_white, 306, 4, 16),
(@h12, @tee_white, 158, 3,  8),
(@h13, @tee_white, 378, 4,  2),
(@h14, @tee_white, 332, 4,  6),
(@h15, @tee_white, 293, 4, 10),
(@h16, @tee_white, 149, 3, 12),
(@h17, @tee_white, 476, 5, 14),
(@h18, @tee_white, 316, 4,  4);

-- ── Gold Men  OUT=2667  IN=2586  TOT=5253 ─────────────────────
-- Note: H8 printed as 323 but corrected to 305 to match OUT=2667
--       H15 printed as 149 but corrected to 228 to match IN=2586
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_m, 438, 5,  9),
(@h2,  @tee_gold_m, 319, 4, 11),
(@h3,  @tee_gold_m, 249, 4, 15),
(@h4,  @tee_gold_m, 103, 3, 17),
(@h5,  @tee_gold_m, 369, 4,  1),
(@h6,  @tee_gold_m, 114, 3, 13),
(@h7,  @tee_gold_m, 447, 5,  5),
(@h8,  @tee_gold_m, 305, 4,  7),
(@h9,  @tee_gold_m, 323, 4,  3),
(@h10, @tee_gold_m, 385, 5, 18),
(@h11, @tee_gold_m, 296, 4, 16),
(@h12, @tee_gold_m, 125, 3,  8),
(@h13, @tee_gold_m, 349, 4,  2),
(@h14, @tee_gold_m, 309, 4,  6),
(@h15, @tee_gold_m, 228, 4, 10),
(@h16, @tee_gold_m, 149, 3, 12),
(@h17, @tee_gold_m, 439, 5, 14),
(@h18, @tee_gold_m, 306, 4,  4);

-- ── Gold Women (same yardages, ladies HCP)  OUT=2667  IN=2586 ─
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold_f, 438, 5,  3),
(@h2,  @tee_gold_f, 319, 4, 11),
(@h3,  @tee_gold_f, 249, 4, 13),
(@h4,  @tee_gold_f, 103, 3, 17),
(@h5,  @tee_gold_f, 369, 4,  1),
(@h6,  @tee_gold_f, 114, 3, 15),
(@h7,  @tee_gold_f, 447, 5,  5),
(@h8,  @tee_gold_f, 305, 4,  9),
(@h9,  @tee_gold_f, 323, 4,  7),
(@h10, @tee_gold_f, 385, 5,  6),
(@h11, @tee_gold_f, 296, 4, 14),
(@h12, @tee_gold_f, 125, 3, 16),
(@h13, @tee_gold_f, 349, 4,  2),
(@h14, @tee_gold_f, 309, 4,  8),
(@h15, @tee_gold_f, 228, 4, 12),
(@h16, @tee_gold_f, 149, 3, 18),
(@h17, @tee_gold_f, 439, 5,  4),
(@h18, @tee_gold_f, 306, 4, 10);

-- ── Red (Ladies)  OUT=2417  IN=2351  TOT=4768 ─────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 416, 5,  3),
(@h2,  @tee_red, 297, 4, 11),
(@h3,  @tee_red, 190, 4, 13),
(@h4,  @tee_red,  79, 3, 17),
(@h5,  @tee_red, 320, 4,  1),
(@h6,  @tee_red, 100, 3, 15),
(@h7,  @tee_red, 417, 5,  5),
(@h8,  @tee_red, 288, 4,  9),
(@h9,  @tee_red, 310, 4,  7),
(@h10, @tee_red, 375, 5,  6),
(@h11, @tee_red, 264, 4, 14),
(@h12, @tee_red, 115, 3, 16),
(@h13, @tee_red, 307, 4,  2),
(@h14, @tee_red, 281, 4,  8),
(@h15, @tee_red, 236, 4, 12),
(@h16, @tee_red, 107, 3, 18),
(@h17, @tee_red, 382, 5,  4),
(@h18, @tee_red, 284, 4, 10);

-- ── Verification queries (run after insert) ───────────────────
-- SELECT ct.tee_name, ct.gender, ct.course_rating, ct.slope_rating,
--        SUM(CASE WHEN h.hole_number <= 9  THEN ht.distance END) AS front_out,
--        SUM(CASE WHEN h.hole_number >= 10 THEN ht.distance END) AS back_in,
--        SUM(ht.distance) AS total
-- FROM course_tee ct
-- JOIN hole_tee ht ON ht.tee_id = ct.id
-- JOIN hole h ON h.id = ht.hole_id
-- WHERE ct.course_id = @course_id
-- GROUP BY ct.id
-- ORDER BY ct.id;
