const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/tournaments - List all tournaments
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       ORDER BY t.date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// GET /api/tournaments/upcoming - Get next 3 upcoming tournaments
router.get('/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.date >= CURDATE()
       ORDER BY t.date ASC
       LIMIT 3`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching upcoming tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming tournaments' });
  }
});

// GET /api/tournaments/:id - Get single tournament
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address, c.phone as course_phone
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching tournament:', err);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// POST /api/tournaments - Create tournament
router.post('/', async (req, res) => {
  try {
    const { date, course_id, number_of_holes } = req.body;
    const [result] = await pool.query(
      'INSERT INTO tournament (date, course_id, number_of_holes) VALUES (?, ?, ?)',
      [date, course_id, number_of_holes || 18]
    );
    res.status(201).json({ id: result.insertId, date, course_id, number_of_holes: number_of_holes || 18 });
  } catch (err) {
    console.error('Error creating tournament:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// PUT /api/tournaments/:id - Update tournament
router.put('/:id', async (req, res) => {
  try {
    const { date, course_id, number_of_holes } = req.body;
    await pool.query(
      'UPDATE tournament SET date = ?, course_id = ?, number_of_holes = ? WHERE id = ?',
      [date, course_id, number_of_holes, req.params.id]
    );
    res.json({ id: req.params.id, date, course_id, number_of_holes });
  } catch (err) {
    console.error('Error updating tournament:', err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// DELETE /api/tournaments/:id - Delete tournament
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tournament WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    console.error('Error deleting tournament:', err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

module.exports = router;
