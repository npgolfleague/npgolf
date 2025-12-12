const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/scores - List all scores
router.get('/', async (req, res) => {
  try {
    const { tournament_id, player_id } = req.query;
    let query = `
      SELECT s.*, 
             p.name as player_name,
             t.date as tournament_date,
             c.name as course_name,
             h.hole_number,
             h.mens_par, h.ladies_par
      FROM scores s
      JOIN players p ON s.player_id = p.id
      JOIN tournament t ON s.tournament_id = t.id
      JOIN course c ON t.course_id = c.id
      JOIN hole h ON s.hole_id = h.id
      WHERE 1=1
    `;
    const params = [];
    
    if (tournament_id) {
      query += ' AND s.tournament_id = ?';
      params.push(tournament_id);
    }
    if (player_id) {
      query += ' AND s.player_id = ?';
      params.push(player_id);
    }
    
    query += ' ORDER BY h.hole_number, p.name';
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// GET /api/scores/tournament/:tournamentId/foursome/:group - Get scores for a specific foursome
router.get('/tournament/:tournamentId/foursome/:group', async (req, res) => {
  try {
    const { tournamentId, group } = req.params;
    const [rows] = await pool.query(
      `SELECT s.*, 
              p.name as player_name, p.sex,
              h.hole_number, h.mens_par, h.ladies_par
       FROM scores s
       JOIN players p ON s.player_id = p.id
       JOIN hole h ON s.hole_id = h.id
       WHERE s.tournament_id = ? AND s.foursome_group = ?
       ORDER BY h.hole_number, p.name`,
      [tournamentId, group]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching foursome scores:', err);
    res.status(500).json({ error: 'Failed to fetch foursome scores' });
  }
});

// POST /api/scores - Create score(s)
router.post('/', async (req, res) => {
  try {
    const { scores } = req.body; // Array of score objects
    
    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'Scores array is required' });
    }
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const score of scores) {
        const { tournament_id, player_id, hole_id, score: scoreValue, quota, foursome_group } = score;
        
        const [result] = await connection.query(
          `INSERT INTO scores (tournament_id, player_id, hole_id, score, quota, foursome_group) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             score = VALUES(score), 
             quota = VALUES(quota), 
             foursome_group = VALUES(foursome_group),
             entered_at = CURRENT_TIMESTAMP`,
          [tournament_id, player_id, hole_id, scoreValue, quota, foursome_group]
        );
        results.push({ id: result.insertId, ...score });
      }
      
      await connection.commit();
      res.status(201).json({ message: 'Scores saved successfully', scores: results });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error creating scores:', err);
    res.status(500).json({ error: 'Failed to create scores' });
  }
});

// PUT /api/scores/:id - Update score
router.put('/:id', async (req, res) => {
  try {
    const { score, quota, foursome_group } = req.body;
    await pool.query(
      'UPDATE scores SET score = ?, quota = ?, foursome_group = ?, entered_at = CURRENT_TIMESTAMP WHERE id = ?',
      [score, quota, foursome_group, req.params.id]
    );
    res.json({ id: req.params.id, score, quota, foursome_group });
  } catch (err) {
    console.error('Error updating score:', err);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// DELETE /api/scores/:id - Delete score
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM scores WHERE id = ?', [req.params.id]);
    res.json({ message: 'Score deleted' });
  } catch (err) {
    console.error('Error deleting score:', err);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

module.exports = router;
