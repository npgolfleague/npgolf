const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/league-select/by-email?email=user@example.com
// Returns all leagues where a player with this email exists
router.get('/by-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find all leagues where this player exists
    const [rows] = await pool.query(`
      SELECT DISTINCT 
        l.id,
        l.name,
        l.alias,
        l.description,
        be.name as billing_entity_name
      FROM leagues l
      JOIN league_players lp ON l.id = lp.league_id
      JOIN players p ON lp.player_id = p.id
      LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
      WHERE p.email = ? AND l.active = 1
      ORDER BY l.name
    `, [email]);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching leagues by email:', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// GET /api/league-select/all
// Returns all active leagues (for initial display before email is entered)
router.get('/all', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        l.id,
        l.name,
        l.alias,
        l.description,
        be.name as billing_entity_name
      FROM leagues l
      LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
      WHERE l.active = 1
      ORDER BY l.name
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching all leagues:', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

module.exports = router;
