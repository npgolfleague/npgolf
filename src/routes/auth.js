const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendSMS } = require('../twilio');
const { sendEmail } = require('../email');

const router = express.Router();

function isStrongPassword(password) {
  const minLen = 8;
  const hasMin = typeof password === 'string' && password.length >= minLen;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasMin && hasLetter && hasNumber;
}

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

// POST /api/auth/register { email, password, name, phone, sex?, quota_18?, quota_9?, sms_allowed? }
router.post('/register', async (req, res) => {
  const { email, password, name, phone, sex, quota_18, quota_9, sms_allowed } = req.body || {};
  if (!email || !password || !name || !phone) {
    return res.status(400).json({ error: 'email, password, name, and phone are required' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include letters and numbers' });
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
      'INSERT INTO players (name, email, password, phone, sex, quota_18, quota_9, role, email_allowed, sms_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone, sex || 'M', quota_18 || 18, quota_9 || 9, 'player', 1, sms_allowed ? 1 : 0]
    );

    const userId = result.insertId;

    // Send SMS opt-in message (only if SMS is enabled and user opted in)
    if (sms_allowed) {
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const optInLink = `${appBaseUrl}/api/players/${userId}/sms-opt-in`;
      const smsMessage = `Welcome to NP Golf League! Click this link to confirm SMS notifications: ${optInLink}`;
      
      try {
        await sendSMS(phone, smsMessage);
        console.log(`SMS opt-in confirmation sent to new player: ${name} (${phone})`);
      } catch (smsErr) {
        console.error('Failed to send SMS opt-in:', smsErr);
        // Don't fail registration if SMS fails
      }
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

// POST /api/auth/forgot-password { email }
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const [rows] = await pool.query('SELECT id, name, email FROM players WHERE email = ? LIMIT 1', [email]);
    const user = rows && rows[0];

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query(
        'UPDATE players SET reset_password_token_hash = ?, reset_password_expires = ? WHERE id = ?',
        [tokenHash, expiresAt, user.id]
      );

      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const resetLink = `${appBaseUrl}/reset-password?token=${rawToken}`;

      const subject = 'NPGOLF Password Reset';
      const html = `
        <p>Hello ${user.name || ''},</p>
        <p>We received a request to reset your NPGOLF password.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `;
      const text = `Hello ${user.name || ''},\n\nWe received a request to reset your NPGOLF password.\n\nReset your password: ${resetLink}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore this email.`;

      try {
        await sendEmail(user.email, subject, html, text);
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr.message);
      }
    }

    return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error', err);
    return res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// POST /api/auth/reset-password { token, password }
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include letters and numbers' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT id FROM players WHERE reset_password_token_hash = ? AND reset_password_expires > NOW() LIMIT 1',
      [tokenHash]
    );

    const user = rows && rows[0];
    if (!user) {
      return res.status(400).json({ error: 'invalid or expired reset token' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashedPassword = await bcrypt.hash(password, rounds);

    await pool.query(
      'UPDATE players SET password = ?, reset_password_token_hash = NULL, reset_password_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
