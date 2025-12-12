const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/courses - list all courses
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, address, phone, created_at FROM course ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/courses/:id - get single course with holes
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [courseRows] = await pool.query('SELECT * FROM course WHERE id = ?', [id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    const [holeRows] = await pool.query(
      'SELECT * FROM hole WHERE course_id = ? ORDER BY hole_number',
      [id]
    );
    
    res.json({ course: courseRows[0], holes: holeRows });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/courses - create course { name, address?, phone? }
router.post('/', async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [result] = await pool.execute(
      'INSERT INTO course (name, address, phone) VALUES (?, ?, ?)',
      [name, address || null, phone || null]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM course WHERE id = ?', [insertedId]);
    console.log(`Course created id=${insertedId} name=${name}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/courses/:id/holes - add holes to a course
router.post('/:id/holes', async (req, res) => {
  const { id } = req.params;
  const { holes } = req.body;
  
  if (!holes || !Array.isArray(holes)) {
    return res.status(400).json({ error: 'holes array is required' });
  }

  try {
    // Verify course exists
    const [courseRows] = await pool.query('SELECT id FROM course WHERE id = ?', [id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Insert all holes
    for (const hole of holes) {
      const { hole_number, mens_distance, mens_par, mens_handicap, ladies_distance, ladies_par, ladies_handicap } = hole;
      
      await pool.execute(
        `INSERT INTO hole (course_id, hole_number, mens_distance, mens_par, mens_handicap, 
         ladies_distance, ladies_par, ladies_handicap) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         mens_distance = VALUES(mens_distance),
         mens_par = VALUES(mens_par),
         mens_handicap = VALUES(mens_handicap),
         ladies_distance = VALUES(ladies_distance),
         ladies_par = VALUES(ladies_par),
         ladies_handicap = VALUES(ladies_handicap)`,
        [id, hole_number, mens_distance, mens_par, mens_handicap, ladies_distance, ladies_par, ladies_handicap]
      );
    }

    const [holeRows] = await pool.query('SELECT * FROM hole WHERE course_id = ? ORDER BY hole_number', [id]);
    res.json(holeRows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/courses/:id - update course info
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, phone } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const [result] = await pool.execute(
      'UPDATE course SET name = ?, address = ?, phone = ? WHERE id = ?',
      [name, address || null, phone || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [rows] = await pool.query('SELECT * FROM course WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/courses/:id - delete course and all its holes
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM course WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
