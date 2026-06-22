-- ============================================================
-- Westchase Golf Club — Manual Data Entry
-- Generated from scorecard PDF
-- Run against: npgolf database (MySQL)
--
-- Tees from scorecard:
--   Championship  72.1/136  (M)  TOT=6487  OUT=3331  IN=3156
--   Clifton       69.6/130  (M)  TOT=6214  OUT=3165  IN=3049
--   Combo         (M)       TOT=5923  OUT=3067  IN=2856  (no rating on card)
--   Combo         (W)       TOT=5757  OUT=2941  IN=2816  (no rating on card)
--   Club          67.5/122  (M)  TOT=5465  OUT=2736  IN=2729
--   Forward       67.0/128  (F)  TOT=4516  OUT=2305  IN=2211
--
-- Handicap assignments:
--   Men's HCP front:   13, 5, 9,15, 1, 7,17,11, 3
--   Men's HCP back:     6,14, 8,16,12,18, 4, 2,10
--   Ladies' HCP front: 13, 3,11,15, 9, 5,17, 7, 1
--   Ladies' HCP back:   2,16,12, 6,14,18,10, 8, 4
-- ============================================================

-- Safety check (uncomment to verify before running):
-- SELECT id, name FROM course WHERE name = 'Westchase Golf Club';

-- ── Step 1: Course ────────────────────────────────────────────
INSERT INTO course (name, is_public)
VALUES ('Westchase Golf Club', 1);
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
VALUES (@course_id, 'Championship','#0066CC', 'M', 72.1, 136);
SET @tee_champ = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Clifton', '#ffffff', 'M', 69.6, 130);
SET @tee_clifton = LAST_INSERT_ID();

-- Combo tees: no official rating/slope listed on scorecard
INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Blue/White Combo', '#ADD8E6', 'M', NULL, NULL);
SET @tee_bwcombo = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'White/Green Combo', '#90EE90', 'M', NULL, NULL);
SET @tee_wgcombo = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Club', '#009900', 'M', 67.5, 122);
SET @tee_club = LAST_INSERT_ID();

INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
VALUES (@course_id, 'Forward', '#CC0000', 'F', 67.0, 128);
SET @tee_forward = LAST_INSERT_ID();

-- ── Step 4: hole_tee records ──────────────────────────────────
-- Par (same all tees):   front  4, 5, 3, 4, 4, 4, 3, 5, 4  (OUT 36)
--                        back   5, 3, 4, 5, 4, 3, 4, 4, 4  (IN  36)  TOT 72
-- Men's HCP:             front 13, 5, 9,15, 1, 7,17,11, 3
--                        back   6,14, 8,16,12,18, 4, 2,10
-- Ladies' HCP:           front 13, 3,11,15, 9, 5,17, 7, 1
--                        back   2,16,12, 6,14,18,10, 8, 4

-- ── Championship (M)  OUT=3331  IN=3156  TOT=6487 ─────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_champ, 326, 4, 13),
(@h2,  @tee_champ, 532, 5,  5),
(@h3,  @tee_champ, 205, 3,  9),
(@h4,  @tee_champ, 368, 4, 15),
(@h5,  @tee_champ, 416, 4,  1),
(@h6,  @tee_champ, 409, 4,  7),
(@h7,  @tee_champ, 160, 3, 17),
(@h8,  @tee_champ, 513, 5, 11),
(@h9,  @tee_champ, 402, 4,  3),
(@h10, @tee_champ, 499, 5,  6),
(@h11, @tee_champ, 185, 3, 14),
(@h12, @tee_champ, 359, 4,  8),
(@h13, @tee_champ, 493, 5, 16),
(@h14, @tee_champ, 352, 4, 12),
(@h15, @tee_champ, 152, 3, 18),
(@h16, @tee_champ, 342, 4,  4),
(@h17, @tee_champ, 394, 4,  2),
(@h18, @tee_champ, 380, 4, 10);

-- ── Blue/White Combo (M)  OUT=3165  IN=3049  TOT=6214 ──────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_bwcombo, 326, 4, 13),
(@h2,  @tee_bwcombo, 508, 5,  5),
(@h3,  @tee_bwcombo, 177, 3,  9),
(@h4,  @tee_bwcombo, 368, 4, 15),
(@h5,  @tee_bwcombo, 391, 4,  1),
(@h6,  @tee_bwcombo, 376, 4,  7),
(@h7,  @tee_bwcombo, 160, 3, 17),
(@h8,  @tee_bwcombo, 486, 5, 11),
(@h9,  @tee_bwcombo, 373, 4,  3),
(@h10, @tee_bwcombo, 472, 5,  6),
(@h11, @tee_bwcombo, 166, 3, 14),
(@h12, @tee_bwcombo, 359, 4,  8),
(@h13, @tee_bwcombo, 493, 5, 16),
(@h14, @tee_bwcombo, 352, 4, 12),
(@h15, @tee_bwcombo, 152, 3, 18),
(@h16, @tee_bwcombo, 308, 4,  4),
(@h17, @tee_bwcombo, 367, 4,  2),
(@h18, @tee_bwcombo, 380, 4, 10);

-- ── Clifton (M)  OUT=3067  IN=2856  TOT=5923 ────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_clifton, 297, 4, 13),
(@h2,  @tee_clifton, 508, 5,  5),
(@h3,  @tee_clifton, 177, 3,  9),
(@h4,  @tee_clifton, 336, 4, 15),
(@h5,  @tee_clifton, 391, 4,  1),
(@h6,  @tee_clifton, 376, 4,  7),
(@h7,  @tee_clifton, 123, 3, 17),
(@h8,  @tee_clifton, 486, 5, 11),
(@h9,  @tee_clifton, 373, 4,  3),
(@h10, @tee_clifton, 472, 5,  6),
(@h11, @tee_clifton, 166, 3, 14),
(@h12, @tee_clifton, 334, 4,  8),
(@h13, @tee_clifton, 446, 5, 16),
(@h14, @tee_clifton, 291, 4, 12),
(@h15, @tee_clifton, 125, 3, 18),
(@h16, @tee_clifton, 308, 4,  4),
(@h17, @tee_clifton, 367, 4,  2),
(@h18, @tee_clifton, 347, 4, 10);

-- ── White Green Combo (M)  OUT=2941  IN=2816  TOT=5757 ────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_wgcombo, 297, 4, 13),
(@h2,  @tee_wgcombo, 494, 5,  3),
(@h3,  @tee_wgcombo, 117, 3, 11),
(@h4,  @tee_wgcombo, 336, 4, 15),
(@h5,  @tee_wgcombo, 391, 4,  9),
(@h6,  @tee_wgcombo, 352, 4,  5),
(@h7,  @tee_wgcombo, 123, 3, 17),
(@h8,  @tee_wgcombo, 458, 5,  7),
(@h9,  @tee_wgcombo, 373, 4,  1),
(@h10, @tee_wgcombo, 472, 5,  2),
(@h11, @tee_wgcombo, 144, 3, 16),
(@h12, @tee_wgcombo, 334, 4, 12),
(@h13, @tee_wgcombo, 446, 5,  6),
(@h14, @tee_wgcombo, 291, 4, 14),
(@h15, @tee_wgcombo, 125, 3, 18),
(@h16, @tee_wgcombo, 308, 4, 10),
(@h17, @tee_wgcombo, 349, 4,  8),
(@h18, @tee_wgcombo, 347, 4,  4);

-- ── Club (M)  OUT=2736  IN=2729  TOT=5465 ─────────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_club, 253, 4, 13),
(@h2,  @tee_club, 494, 5,  5),
(@h3,  @tee_club, 117, 3,  9),
(@h4,  @tee_club, 254, 4, 15),
(@h5,  @tee_club, 365, 4,  1),
(@h6,  @tee_club, 352, 4,  7),
(@h7,  @tee_club,  96, 3, 17),
(@h8,  @tee_club, 458, 5, 11),
(@h9,  @tee_club, 347, 4,  3),
(@h10, @tee_club, 459, 5,  6),
(@h11, @tee_club, 144, 3, 14),
(@h12, @tee_club, 319, 4,  8),
(@h13, @tee_club, 430, 5, 16),
(@h14, @tee_club, 274, 4, 12),
(@h15, @tee_club, 125, 3, 18),
(@h16, @tee_club, 296, 4,  4),
(@h17, @tee_club, 349, 4,  2),
(@h18, @tee_club, 333, 4, 10);

-- ── Forward (F)  OUT=2305  IN=2211  TOT=4516 ──────────────────
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap) VALUES
(@h1,  @tee_forward, 227, 4, 13),
(@h2,  @tee_forward, 425, 5,  3),
(@h3,  @tee_forward,  77, 3, 11),
(@h4,  @tee_forward, 254, 4, 15),
(@h5,  @tee_forward, 303, 4,  9),
(@h6,  @tee_forward, 261, 4,  5),
(@h7,  @tee_forward,  80, 3, 17),
(@h8,  @tee_forward, 389, 5,  7),
(@h9,  @tee_forward, 289, 4,  1),
(@h10, @tee_forward, 408, 5,  2),
(@h11, @tee_forward,  79, 3, 16),
(@h12, @tee_forward, 227, 4, 12),
(@h13, @tee_forward, 405, 5,  6),
(@h14, @tee_forward, 240, 4, 14),
(@h15, @tee_forward, 102, 3, 18),
(@h16, @tee_forward, 237, 4, 10),
(@h17, @tee_forward, 274, 4,  8),
(@h18, @tee_forward, 239, 4,  4);

-- ── Verification Queries (uncomment to check after insert) ────
-- SELECT ct.tee_name, ct.course_rating, ct.slope_rating,
--        SUM(CASE WHEN h.hole_number <= 9  THEN ht.distance END) AS out_yards,
--        SUM(CASE WHEN h.hole_number >= 10 THEN ht.distance END) AS in_yards,
--        SUM(ht.distance) AS total_yards
-- FROM course c
-- JOIN course_tee ct ON ct.course_id = c.id
-- JOIN hole_tee ht ON ht.tee_id = ct.id
-- JOIN hole h ON h.id = ht.hole_id
-- WHERE c.name = 'Westchase Golf Club'
-- GROUP BY ct.tee_name, ct.course_rating, ct.slope_rating
-- ORDER BY ct.gender, total_yards DESC;
