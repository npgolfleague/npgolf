const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// POST /api/auth/login { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const [rows] = await pool.query('SELECT id, name, email, sex, active, quota, role, password FROM players WHERE email = ? LIMIT 1', [email]);
    const user = rows && rows[0];
    if (!user || !user.password) return res.status(401).json({ error: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'server misconfigured' });
    }

    const payload = { sub: user.id, email: user.email };
    const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, sex: user.sex, active: user.active, quota: user.quota, role: user.role } });
  } catch (err) {
    console.error('Auth error', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register { email, password, name, sex?, quota? }
router.post('/register', async (req, res) => {
  const { email, password, name, sex, quota } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  try {
    // Check if email already exists
    const [existing] = await pool.query('SELECT id FROM players WHERE email = ? LIMIT 1', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashedPassword = await bcrypt.hash(password, rounds);

    // Insert new player
    const [result] = await pool.query(
      'INSERT INTO players (name, email, password, sex, quota, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, sex || 'M', quota || 18, 'player']
    );

    const userId = result.insertId;

    // Generate token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'server misconfigured' });
    }

    const payload = { sub: userId, email };
    const token = jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

    res.status(201).json({
      token,
      user: { id: userId, name, email, sex: sex || 'M', quota: quota || 18, role: 'player' }
    });
  } catch (err) {
    console.error('Registration error', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
