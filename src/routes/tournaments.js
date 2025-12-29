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

// POST /api/tournaments/:id/complete - Complete tournament and update quota history
router.post('/:id/complete', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const tournamentId = req.params.id;
    
    // Get tournament date
    const [tournamentRows] = await connection.query(
      'SELECT date FROM tournament WHERE id = ?',
      [tournamentId]
    );
    
    if (tournamentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournamentDate = tournamentRows[0].date;
    
    // Get all players who participated in this tournament with their scores
    const [scoresRows] = await connection.query(
      `SELECT s.player_id, p.quota, SUM(s.score - s.quota) as total_points
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ?
       GROUP BY s.player_id, p.quota`,
      [tournamentId]
    );
    
    if (scoresRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No scores found for this tournament' });
    }
    
    // For each player, shift quota history and add new result
    for (const player of scoresRows) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const quotaDiff = totalPoints; // positive = above quota, negative = below
      
      // Get current quota record for this player
      const [quotaRows] = await connection.query(
        'SELECT * FROM quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      
      if (quotaRows.length === 0) {
        // Create new quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO quota (player_id, date_1, points_1, quota_diff_1)
           VALUES (?, ?, ?, ?)`,
          [playerId, tournamentDate, totalPoints, quotaDiff]
        );
      } else {
        // Shift existing data and insert new tournament result
        const quota = quotaRows[0];
        await connection.query(
          `UPDATE quota SET
            date_7 = ?, points_7 = ?, quota_diff_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?
           WHERE player_id = ?`,
          [
            quota.date_6, quota.points_6, quota.quota_diff_6,
            quota.date_5, quota.points_5, quota.quota_diff_5,
            quota.date_4, quota.points_4, quota.quota_diff_4,
            quota.date_3, quota.points_3, quota.quota_diff_3,
            quota.date_2, quota.points_2, quota.quota_diff_2,
            quota.date_1, quota.points_1, quota.quota_diff_1,
            tournamentDate, totalPoints, quotaDiff,
            playerId
          ]
        );
      }
    }
    
    // Now do the same for skins_quota (20 slots instead of 7)
    for (const player of scoresRows) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const quotaDiff = totalPoints;
      
      // Get current skins_quota record for this player
      const [skinsQuotaRows] = await connection.query(
        'SELECT * FROM skins_quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      
      if (skinsQuotaRows.length === 0) {
        // Create new skins_quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO skins_quota (player_id, date_1, points_1, quota_diff_1)
           VALUES (?, ?, ?, ?)`,
          [playerId, tournamentDate, totalPoints, quotaDiff]
        );
      } else {
        // Shift existing data: 19->20, 18->19, ..., 1->2, and new->1
        const sq = skinsQuotaRows[0];
        await connection.query(
          `UPDATE skins_quota SET
            date_20 = ?, points_20 = ?, quota_diff_20 = ?,
            date_19 = ?, points_19 = ?, quota_diff_19 = ?,
            date_18 = ?, points_18 = ?, quota_diff_18 = ?,
            date_17 = ?, points_17 = ?, quota_diff_17 = ?,
            date_16 = ?, points_16 = ?, quota_diff_16 = ?,
            date_15 = ?, points_15 = ?, quota_diff_15 = ?,
            date_14 = ?, points_14 = ?, quota_diff_14 = ?,
            date_13 = ?, points_13 = ?, quota_diff_13 = ?,
            date_12 = ?, points_12 = ?, quota_diff_12 = ?,
            date_11 = ?, points_11 = ?, quota_diff_11 = ?,
            date_10 = ?, points_10 = ?, quota_diff_10 = ?,
            date_9 = ?, points_9 = ?, quota_diff_9 = ?,
            date_8 = ?, points_8 = ?, quota_diff_8 = ?,
            date_7 = ?, points_7 = ?, quota_diff_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?
           WHERE player_id = ?`,
          [
            sq.date_19, sq.points_19, sq.quota_diff_19,
            sq.date_18, sq.points_18, sq.quota_diff_18,
            sq.date_17, sq.points_17, sq.quota_diff_17,
            sq.date_16, sq.points_16, sq.quota_diff_16,
            sq.date_15, sq.points_15, sq.quota_diff_15,
            sq.date_14, sq.points_14, sq.quota_diff_14,
            sq.date_13, sq.points_13, sq.quota_diff_13,
            sq.date_12, sq.points_12, sq.quota_diff_12,
            sq.date_11, sq.points_11, sq.quota_diff_11,
            sq.date_10, sq.points_10, sq.quota_diff_10,
            sq.date_9, sq.points_9, sq.quota_diff_9,
            sq.date_8, sq.points_8, sq.quota_diff_8,
            sq.date_7, sq.points_7, sq.quota_diff_7,
            sq.date_6, sq.points_6, sq.quota_diff_6,
            sq.date_5, sq.points_5, sq.quota_diff_5,
            sq.date_4, sq.points_4, sq.quota_diff_4,
            sq.date_3, sq.points_3, sq.quota_diff_3,
            sq.date_2, sq.points_2, sq.quota_diff_2,
            sq.date_1, sq.points_1, sq.quota_diff_1,
            tournamentDate, totalPoints, quotaDiff,
            playerId
          ]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Tournament completed successfully', playersUpdated: scoresRows.length });
    
  } catch (err) {
    await connection.rollback();
    console.error('Error completing tournament:', err);
    res.status(500).json({ error: 'Failed to complete tournament' });
  } finally {
    connection.release();
  }
});

module.exports = router;
