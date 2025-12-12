const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify admin role
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const decoded = jwt.verify(token, secret);
    const [rows] = await pool.query('SELECT role FROM players WHERE id = ?', [decoded.sub]);
    
    if (!rows[0] || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings LIMIT 1');
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put('/', requireAdmin, async (req, res) => {
  const { tournament_fee_18_holes, tournament_fee_9_holes } = req.body;

  if (tournament_fee_18_holes === undefined && tournament_fee_9_holes === undefined) {
    return res.status(400).json({ error: 'No settings provided to update' });
  }

  try {
    const updates = [];
    const values = [];

    if (tournament_fee_18_holes !== undefined) {
      updates.push('tournament_fee_18_holes = ?');
      values.push(tournament_fee_18_holes);
    }

    if (tournament_fee_9_holes !== undefined) {
      updates.push('tournament_fee_9_holes = ?');
      values.push(tournament_fee_9_holes);
    }

    await pool.query(
      `UPDATE settings SET ${updates.join(', ')} WHERE id = 1`,
      values
    );

    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
