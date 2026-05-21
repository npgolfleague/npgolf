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

    const normalizedEmail = String(email).trim();

    // Find all active leagues with a valid alias where this player exists
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
      WHERE LOWER(p.email) = LOWER(?)
        AND l.active = 1
        AND l.alias IS NOT NULL
        AND TRIM(l.alias) <> ''
      ORDER BY l.name
    `, [normalizedEmail]);

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
    const alias = String(req.query?.alias || '').trim();

    if (alias) {
      const [aliasRows] = await pool.query(
        'SELECT id, billing_entity_id, active FROM leagues WHERE alias = ? LIMIT 1',
        [alias]
      );

      const contextLeague = aliasRows && aliasRows[0];
      if (!contextLeague) {
        return res.status(404).json({ error: 'League alias not found' });
      }
      if (!contextLeague.active) {
        return res.status(403).json({ error: 'League alias is not active' });
      }

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
          AND l.alias IS NOT NULL
          AND TRIM(l.alias) <> ''
          AND l.billing_entity_id = ?
        ORDER BY l.name
      `, [contextLeague.billing_entity_id]);

      return res.json(rows);
    }

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
        AND l.alias IS NOT NULL
        AND TRIM(l.alias) <> ''
      ORDER BY l.name
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching all leagues:', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

module.exports = router;
