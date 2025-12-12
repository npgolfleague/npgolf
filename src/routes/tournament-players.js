const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/tournaments/:tournamentId/players - Get all players in a tournament
router.get('/:tournamentId/players', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.email, p.phone, p.sex, p.quota, p.role, tp.registration_date
      FROM players p
      JOIN tournament_players tp ON p.id = tp.player_id
      WHERE tp.tournament_id = ?
      ORDER BY p.name ASC
    `, [tournamentId]);
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/tournaments/:tournamentId/players - Add a player to a tournament
// Body: { playerId }
router.post('/:tournamentId/players', async (req, res) => {
  const { tournamentId } = req.params;
  const { playerId } = req.body;
  
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  
  try {
    // Check if tournament exists
    const [tournaments] = await pool.query('SELECT id FROM tournament WHERE id = ?', [tournamentId]);
    if (tournaments.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if player exists
    const [players] = await pool.query('SELECT id FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Add player to tournament (unique constraint will prevent duplicates)
    await pool.query(
      'INSERT INTO tournament_players (tournament_id, player_id) VALUES (?, ?)',
      [tournamentId, playerId]
    );
    
    res.status(201).json({ message: 'Player added to tournament successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Player already registered for this tournament' });
    }
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/tournaments/:tournamentId/players/:playerId - Remove a player from a tournament
router.delete('/:tournamentId/players/:playerId', async (req, res) => {
  const { tournamentId, playerId } = req.params;
  
  try {
    const [result] = await pool.query(
      'DELETE FROM tournament_players WHERE tournament_id = ? AND player_id = ?',
      [tournamentId, playerId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found in this tournament' });
    }
    
    res.json({ message: 'Player removed from tournament successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/tournaments/:tournamentId/available-players - Get players NOT in the tournament
router.get('/:tournamentId/available-players', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.email, p.phone, p.sex, p.quota, p.role
      FROM players p
      WHERE p.active = 1
        AND p.id NOT IN (
          SELECT player_id 
          FROM tournament_players 
          WHERE tournament_id = ?
        )
      ORDER BY p.name ASC
    `, [tournamentId]);
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
