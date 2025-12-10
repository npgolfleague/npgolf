const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const router = express.Router();

// GET /api/users - list players
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota, fedex_points, tournaments_played, prize_money, role, created_at FROM players WHERE active = 1 ORDER BY fedex_points DESC, name ASC');
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/users - create player { name, email, password?, phone?, sex?, active?, quota? }
// If `password` is provided it will be hashed before storing. Password is nullable
// to preserve backwards compatibility.
router.post('/', async (req, res) => {
  const { name, email, password, phone, sex, active, quota } = req.body;
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
      'INSERT INTO players (name, email, phone, sex, active, quota, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, sex || null, activeValue, quota || null, hashed]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, active, quota, created_at FROM players WHERE id = ?', [insertedId]);
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

// PUT /api/users/:id - update player
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, sex, quota, fedex_points, tournaments_played, prize_money, active, role } = req.body;
  
  try {
    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (sex !== undefined) { updates.push('sex = ?'); values.push(sex); }
    if (quota !== undefined) { updates.push('quota = ?'); values.push(quota); }
    if (fedex_points !== undefined) { updates.push('fedex_points = ?'); values.push(fedex_points); }
    if (tournaments_played !== undefined) { updates.push('tournaments_played = ?'); values.push(tournaments_played); }
    if (prize_money !== undefined) { updates.push('prize_money = ?'); values.push(prize_money); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?`;
    
    await pool.execute(sql, values);
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota, fedex_points, tournaments_played, prize_money, role, active, created_at FROM players WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
