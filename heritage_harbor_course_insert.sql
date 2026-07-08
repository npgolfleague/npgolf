-- ============================================================
-- Heritage Harbor Golf & Country Club — Manual Data Entry
-- Generated from the official scorecard PDF
-- Run against: npgolf database (MySQL)
--
-- Verified from: https://www.heritageharborgolf.com/wp-content/uploads/sites/6836/2025/05/scorecard-1.pdf
-- Printed card shows the same handicap sequence for the mens and ladies rows.
-- ============================================================

-- Safety check (uncomment to verify before running):
-- SELECT id, name FROM course WHERE name = 'Heritage Harbor Golf & Country Club';

-- ── Step 1: Course ────────────────────────────────────────────
INSERT INTO course (name, address, phone, is_public)
VALUES (
  'Heritage Harbor Golf & Country Club',
  '19502 Heritage Harbor Parkway, Lutz, FL 33558',
  '813-949-4886',
  1
);
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
VALUES (@course_id, 'Gold', '#FFB300', 'M', 73.5, 129);
SET @tee_gold = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue', '#0066CC', 'M', 69.4, 117);
SET @tee_blue = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White', '#FFFFFF', 'M', 66.9, 109);
SET @tee_white = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Red', '#CC0000', 'F', 68.2, 116);
SET @tee_red = LAST_INSERT_ID();

-- ── Step 4: hole_tee records ──────────────────────────────────
-- Par (same all tees):  front 4,4,3,4,5,4,3,5,4  back 5,4,4,4,3,5,3,4,4
-- Men's HCP:            front 12,14,18,6,4,8,16,2,10  back 3,11,5,7,15,1,17,13,9
-- Ladies' HCP:          front 12,14,18,6,4,8,16,2,10  back 3,11,5,7,15,1,17,13,9

-- Gold (Men)  OUT=3323  IN=3575  TOT=6898
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_gold, 346, 4, 12),
(@h2,  @tee_gold, 300, 4, 14),
(@h3,  @tee_gold, 181, 3, 18),
(@h4,  @tee_gold, 422, 4,  6),
(@h5,  @tee_gold, 519, 5,  4),
(@h6,  @tee_gold, 412, 4,  8),
(@h7,  @tee_gold, 213, 3, 16),
(@h8,  @tee_gold, 557, 5,  2),
(@h9,  @tee_gold, 373, 4, 10),
(@h10, @tee_gold, 556, 5,  3),
(@h11, @tee_gold, 387, 4, 11),
(@h12, @tee_gold, 417, 4,  5),
(@h13, @tee_gold, 415, 4,  7),
(@h14, @tee_gold, 263, 3, 15),
(@h15, @tee_gold, 577, 5,  1),
(@h16, @tee_gold, 176, 3, 17),
(@h17, @tee_gold, 406, 4, 13),
(@h18, @tee_gold, 378, 4,  9);

-- Blue (Men)  OUT=3012  IN=3041  TOT=6053
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_blue, 306, 4, 12),
(@h2,  @tee_blue, 287, 4, 14),
(@h3,  @tee_blue, 150, 3, 18),
(@h4,  @tee_blue, 394, 4,  6),
(@h5,  @tee_blue, 463, 5,  4),
(@h6,  @tee_blue, 395, 4,  8),
(@h7,  @tee_blue, 177, 3, 16),
(@h8,  @tee_blue, 496, 5,  2),
(@h9,  @tee_blue, 344, 4, 10),
(@h10, @tee_blue, 537, 5,  3),
(@h11, @tee_blue, 339, 4, 11),
(@h12, @tee_blue, 323, 4,  5),
(@h13, @tee_blue, 355, 4,  7),
(@h14, @tee_blue, 131, 3, 15),
(@h15, @tee_blue, 533, 5,  1),
(@h16, @tee_blue, 143, 3, 17),
(@h17, @tee_blue, 349, 4, 13),
(@h18, @tee_blue, 331, 4,  9);

-- White (Men)  OUT=2702  IN=2785  TOT=5487
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_white, 286, 4, 12),
(@h2,  @tee_white, 250, 4, 14),
(@h3,  @tee_white, 137, 3, 18),
(@h4,  @tee_white, 292, 4,  6),
(@h5,  @tee_white, 445, 5,  4),
(@h6,  @tee_white, 352, 4,  8),
(@h7,  @tee_white, 169, 3, 16),
(@h8,  @tee_white, 458, 5,  2),
(@h9,  @tee_white, 313, 4, 10),
(@h10, @tee_white, 482, 5,  3),
(@h11, @tee_white, 309, 4, 11),
(@h12, @tee_white, 295, 4,  5),
(@h13, @tee_white, 319, 4,  7),
(@h14, @tee_white, 118, 3, 15),
(@h15, @tee_white, 505, 5,  1),
(@h16, @tee_white, 127, 3, 17),
(@h17, @tee_white, 317, 4, 13),
(@h18, @tee_white, 313, 4,  9);

-- Red (Ladies)  OUT=2329  IN=2444  TOT=4773
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_red, 250, 4, 12),
(@h2,  @tee_red, 236, 4, 14),
(@h3,  @tee_red,  90, 3, 18),
(@h4,  @tee_red, 282, 4,  6),
(@h5,  @tee_red, 379, 5,  4),
(@h6,  @tee_red, 306, 4,  8),
(@h7,  @tee_red, 125, 3, 16),
(@h8,  @tee_red, 398, 5,  2),
(@h9,  @tee_red, 263, 4, 10),
(@h10, @tee_red, 428, 5,  3),
(@h11, @tee_red, 253, 4, 11),
(@h12, @tee_red, 264, 4,  5),
(@h13, @tee_red, 280, 4,  7),
(@h14, @tee_red, 104, 3, 15),
(@h15, @tee_red, 468, 5,  1),
(@h16, @tee_red,  90, 3, 17),
(@h17, @tee_red, 282, 4, 13),
(@h18, @tee_red, 275, 4,  9);

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