const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const router = express.Router();

// GET /api/users - list players
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, sex, active, quota, created_at FROM players ORDER BY id DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/users - create player { name, email, password?, sex?, active?, quota? }
// If `password` is provided it will be hashed before storing. Password is nullable
// to preserve backwards compatibility.
router.post('/', async (req, res) => {
  const { name, email, password, sex, active, quota } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  try {
    let hashed = null;
    if (password) {
      // Basic password validation: minimum 8 chars, includes letters and numbers
      const minLen = 8;
      const hasMin = typeof password === 'string' && password.length >= minLen;
      const hasLetter = /[A-Za-z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!hasMin || !hasLetter || !hasNumber) {
        return res.status(400).json({ error: `password must be at least ${minLen} characters and include letters and numbers` });
      }

      const rounds = process.env.BCRYPT_ROUNDS ? Number(process.env.BCRYPT_ROUNDS) : 10;
      hashed = await bcrypt.hash(password, rounds);
    }

    const activeValue = active !== undefined ? active : 1;
    const [result] = await pool.execute(
      'INSERT INTO players (name, email, sex, active, quota, password) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, sex || null, activeValue, quota || null, hashed]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT id, name, email, sex, active, quota, created_at FROM players WHERE id = ?', [insertedId]);
    // Log successful creation for easier debugging (id and email only)
    try {
      console.log(`Player created id=${insertedId} email=${email}`);
    } catch (logErr) {
      // ensure logging errors don't interfere with response
      console.error('Logging error', logErr);
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
