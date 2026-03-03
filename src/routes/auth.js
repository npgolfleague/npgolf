const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendSMS } = require('../twilio');

const router = express.Router();

// POST /api/auth/login { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const [rows] = await pool.query('SELECT id, name, email, sex, active, quota_18, quota_9, role, password FROM players WHERE email = ? LIMIT 1', [email]);
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

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, sex: user.sex, active: user.active, quota_18: user.quota_18, quota_9: user.quota_9, role: user.role } });
  } catch (err) {
    console.error('Auth error', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register { email, password, name, phone, sex?, quota_18?, quota_9? }
router.post('/register', async (req, res) => {
  const { email, password, name, phone, sex, quota_18, quota_9 } = req.body || {};
  if (!email || !password || !name || !phone) {
    return res.status(400).json({ error: 'email, password, name, and phone are required' });
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
      'INSERT INTO players (name, email, password, phone, sex, quota_18, quota_9, role, email_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone, sex || 'M', quota_18 || 18, quota_9 || 9, 'player', 1]
    );

    const userId = result.insertId;

    // Send SMS opt-in message
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const optInLink = `${appBaseUrl}/api/players/${userId}/sms-opt-in`;
    const smsMessage = `Welcome to npgolf! Click this link to authorize receiving text messages: ${optInLink}`;
    
    try {
      await sendSMS(phone, smsMessage);
      console.log(`SMS opt-in sent to new player: ${name} (${phone})`);
    } catch (smsErr) {
      console.error('Failed to send SMS opt-in:', smsErr);
      // Don't fail registration if SMS fails
    }

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
      user: { id: userId, name, email, phone, sex: sex || 'M', quota_18: quota_18 || 18, quota_9: quota_9 || 9, role: 'player' }
    });
  } catch (err) {
    console.error('Registration error', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
