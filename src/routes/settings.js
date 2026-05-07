const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { getLeagueId } = require('../utils/league');
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
    const leagueId = getLeagueId(req);
    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [leagueId]);
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
  const {
    tournament_fee_18_holes, tournament_fee_9_holes,
    skins_ctp_fee_18_holes, skins_ctp_fee_9_holes,
    golf_course_email,
    quota_points_albatross, quota_points_eagle, quota_points_birdie,
    quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse
  } = req.body;

  if (tournament_fee_18_holes === undefined && tournament_fee_9_holes === undefined && 
      skins_ctp_fee_18_holes === undefined && skins_ctp_fee_9_holes === undefined && 
      golf_course_email === undefined &&
      quota_points_albatross === undefined && quota_points_eagle === undefined &&
      quota_points_birdie === undefined && quota_points_par === undefined &&
      quota_points_bogey === undefined && quota_points_double_bogey === undefined &&
      quota_points_worse === undefined) {
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

    if (skins_ctp_fee_18_holes !== undefined) {
      updates.push('skins_ctp_fee_18_holes = ?');
      values.push(skins_ctp_fee_18_holes);
    }

    if (skins_ctp_fee_9_holes !== undefined) {
      updates.push('skins_ctp_fee_9_holes = ?');
      values.push(skins_ctp_fee_9_holes);
    }

    if (golf_course_email !== undefined) {
      updates.push('golf_course_email = ?');
      values.push(golf_course_email);
    }

    if (quota_points_albatross !== undefined) { updates.push('quota_points_albatross = ?'); values.push(quota_points_albatross); }
    if (quota_points_eagle !== undefined) { updates.push('quota_points_eagle = ?'); values.push(quota_points_eagle); }
    if (quota_points_birdie !== undefined) { updates.push('quota_points_birdie = ?'); values.push(quota_points_birdie); }
    if (quota_points_par !== undefined) { updates.push('quota_points_par = ?'); values.push(quota_points_par); }
    if (quota_points_bogey !== undefined) { updates.push('quota_points_bogey = ?'); values.push(quota_points_bogey); }
    if (quota_points_double_bogey !== undefined) { updates.push('quota_points_double_bogey = ?'); values.push(quota_points_double_bogey); }
    if (quota_points_worse !== undefined) { updates.push('quota_points_worse = ?'); values.push(quota_points_worse); }

    await pool.query(
      `UPDATE league_settings SET ${updates.join(', ')} WHERE league_id = ?`,
      [...values, getLeagueId(req)]
    );

    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [getLeagueId(req)]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
