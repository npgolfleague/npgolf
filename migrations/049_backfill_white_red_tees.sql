-- Migration 049: Back-fill course_tee and hole_tee from existing hole data
-- Creates a White (M) tee and a Red (F) tee for every existing course, then
-- populates hole_tee from the hole table's mens_* and ladies_* columns.
-- course_rating and slope_rating are left NULL and should be filled in manually
-- or via the scorecard parser once available.

-- 1. Create White (Men's) tee for every course that has holes
INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
SELECT DISTINCT course_id, 'White', '#FFFFFF', 'M', NULL, NULL
FROM hole
ORDER BY course_id;

-- 2. Create Red (Ladies') tee for every course that has holes
INSERT INTO course_tee (course_id, tee_name, tee_color, gender, course_rating, slope_rating)
SELECT DISTINCT course_id, 'Red', '#CC0000', 'F', NULL, NULL
FROM hole
ORDER BY course_id;

-- 3. Back-fill hole_tee rows for White tee (mens data)
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap)
SELECT h.id, ct.id, h.mens_distance, h.mens_par, h.mens_handicap
FROM hole h
JOIN course_tee ct ON ct.course_id = h.course_id AND ct.tee_name = 'White';

-- 4. Back-fill hole_tee rows for Red tee (ladies data)
INSERT INTO hole_tee (hole_id, tee_id, distance, par, handicap)
SELECT h.id, ct.id, h.ladies_distance, h.ladies_par, h.ladies_handicap
FROM hole h
JOIN course_tee ct ON ct.course_id = h.course_id AND ct.tee_name = 'Red';
