const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendSMS } = require('../twilio');
const { sendEmail } = require('../email');
const { escapeHtml } = require('../utils/html');
const { signAccessToken } = require('../utils/authTokens');
const { Limiter, clientIp, limitByIp, tooMany } = require('../middleware/rateLimit');

const router = express.Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getOutgoingEmailDelayMs = () => Math.max(Number(process.env.OUTGOING_EMAIL_DELAY_MS || process.env.INVITATION_EMAIL_DELAY_MS || 3000), 0);

const MINUTE = 60 * 1000;
// Failed logins only, so players sharing a clubhouse network aren't blocked by
// each other's successful logins.
const loginLimits = {
  account: new Limiter({ max: 8, windowMs: 15 * MINUTE }), // one address guessing one account
  ip: new Limiter({ max: 40, windowMs: 15 * MINUTE }),     // one address guessing many accounts
  email: new Limiter({ max: 60, windowMs: 60 * MINUTE })   // many addresses guessing one account
};
const registerLimit = new Limiter({ max: 15, windowMs: 60 * MINUTE });
const forgotIpLimit = new Limiter({ max: 15, windowMs: 60 * MINUTE });
const forgotEmailLimit = new Limiter({ max: 3, windowMs: 60 * MINUTE });
const resetLimit = new Limiter({ max: 20, windowMs: 60 * MINUTE });

// For tests.
const resetAuthLimits = () => {
  [...Object.values(loginLimits), registerLimit, forgotIpLimit, forgotEmailLimit, resetLimit].forEach((l) => l.clear());
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// A person's name: no links, markup or control characters.
function isPlausibleName(name) {
  if (typeof name !== 'string') return false;
  const value = name.trim();
  if (value.length < 2 || value.length > 60) return false;
  if (/[<>\u0000-\u001f]|:\/\/|www\./i.test(value)) return false;
  return !/\w\.[a-z]{2,}\//i.test(value);
}

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
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'email and password are required' });
  const normalizedEmail = email.trim();

  const ip = clientIp(req);
  const emailKey = normalizedEmail.toLowerCase().slice(0, 255);
  const accountKey = `${ip}|${emailKey}`;
  const wait = Math.max(
    loginLimits.account.blockedFor(accountKey),
    loginLimits.ip.blockedFor(ip),
    loginLimits.email.blockedFor(emailKey)
  );
  if (wait) return tooMany(res, wait);
  const loginFailed = () => {
    loginLimits.account.hit(accountKey);
    loginLimits.ip.hit(ip);
    loginLimits.email.hit(emailKey);
    return res.status(401).json({ error: 'invalid credentials' });
  };

  try {
    const leagueBillingEntityId = req.league?.billing_entity_id ?? null;
    // Quota is per league: report the quota for the league being signed into.
    const [rows] = await pool.query(
      `SELECT p.id, p.billing_entity_id, p.name, p.email, p.sex, p.active, lp.quota_18, lp.quota_9, p.role, p.password
       FROM players p
       LEFT JOIN league_players lp ON lp.player_id = p.id AND lp.league_id = ?
       WHERE LOWER(p.email) = LOWER(?)
       ORDER BY
         CASE
           WHEN ? IS NOT NULL AND p.billing_entity_id = ? THEN 0
           ELSE 1
         END,
         p.id DESC
       LIMIT 1`,
      [req.league?.id ?? null, normalizedEmail, leagueBillingEntityId, leagueBillingEntityId]
    );
    const user = rows && rows[0];
    if (!user || !user.password) return loginFailed();

    const match = await bcrypt.compare(password, user.password);
    if (!match) return loginFailed();
    if (Number(user.active) === 0) {
      return res.status(403).json({ error: 'This account is deactivated. Contact your league admin.' });
    }
    loginLimits.account.clear(accountKey);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ error: 'server misconfigured' });
    }

    const token = signAccessToken(user, secret, jwtExpiresIn);
    // create refresh token (30 days)
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const refreshExpires = new Date(Date.now() + (process.env.REFRESH_TOKEN_DAYS ? Number(process.env.REFRESH_TOKEN_DAYS) : 30) * 24 * 60 * 60 * 1000)
    await pool.query('UPDATE players SET refresh_token_hash = ?, refresh_token_expires = ? WHERE id = ?', [refreshHash, refreshExpires, user.id])

    res.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, sex: user.sex, active: user.active, quota_18: user.quota_18, quota_9: user.quota_9, role: user.role } });
  } catch (err) {
    console.error('Auth error', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/register { email, password, name, phone, sex?, quota_18?, quota_9?, sms_allowed?, league_id? }
router.post('/register', limitByIp(registerLimit), async (req, res) => {
  const { email, password, name, phone, sex, quota_18, quota_9, sms_allowed, league_id, website } = req.body || {};
  // Hidden on the form, so only a bot fills it in.
  if (website) return res.status(400).json({ error: 'Registration failed' });
  if (!email || !password || !name || !phone) {
    return res.status(400).json({ error: 'email, password, name, and phone are required' });
  }
  if (!isPlausibleName(name)) {
    return res.status(400).json({ error: 'Please enter your name, without links or symbols' });
  }
  if (typeof email !== 'string' || email.length > 255 || !EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  if (typeof phone !== 'string' || !/^[0-9+().\-\s]{7,25}$/.test(phone)) {
    return res.status(400).json({ error: 'Please enter a valid phone number' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include letters and numbers' });
  }

  try {
    const parsedLeagueId = league_id === undefined || league_id === null || league_id === ''
      ? null
      : Number(league_id);

    if (parsedLeagueId !== null && (!Number.isInteger(parsedLeagueId) || parsedLeagueId <= 0)) {
      return res.status(400).json({ error: 'league_id must be a positive integer' });
    }

    if (req.league && parsedLeagueId !== null && req.league.id !== parsedLeagueId) {
      return res.status(400).json({ error: 'league_id does not match URL league context' });
    }

    const targetLeagueId = req.league?.id || parsedLeagueId;
    if (!targetLeagueId) {
      return res.status(400).json({ error: 'league_id is required' });
    }

    const [leagueRows] = await pool.query(
      'SELECT id, billing_entity_id, active FROM leagues WHERE id = ? LIMIT 1',
      [targetLeagueId]
    );
    const targetLeague = leagueRows && leagueRows[0];

    if (!targetLeague || !targetLeague.active) {
      return res.status(400).json({ error: 'Selected league is not available' });
    }

    if (!targetLeague.billing_entity_id) {
      return res.status(400).json({ error: 'Selected league is not configured for registration yet' });
    }

    // Check if email is already registered in this league (case-insensitive)
    const [existing] = await pool.query(
      `SELECT p.id
       FROM players p
       JOIN league_players lp ON lp.player_id = p.id
       WHERE lp.league_id = ?
         AND LOWER(p.email) = LOWER(?)
       LIMIT 1`,
      [targetLeague.id, email]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered for this league' });
    }

    // Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashedPassword = await bcrypt.hash(password, rounds);

    const normalizedQuota18 = quota_18 === undefined || quota_18 === null || quota_18 === ''
      ? null
      : Number(quota_18);
    const normalizedQuota9 = quota_9 === undefined || quota_9 === null || quota_9 === ''
      ? null
      : Number(quota_9);

    // Insert new player
    const [result] = await pool.query(
      'INSERT INTO players (billing_entity_id, name, email, password, phone, sex, role, email_allowed, sms_allowed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [targetLeague.billing_entity_id, name, email, hashedPassword, phone, sex || 'M', 'player', 1, sms_allowed ? 1 : 0]
    );

    const userId = result.insertId;

    // Quota is stored per league on the membership row.
    await pool.query(
      'INSERT IGNORE INTO league_players (league_id, player_id, quota_18, quota_9) VALUES (?, ?, ?, ?)',
      [targetLeague.id, userId, normalizedQuota18, normalizedQuota9]
    );

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

    const token = signAccessToken({ id: userId, email, password: hashedPassword }, secret, jwtExpiresIn);
    // create refresh token (30 days)
    const refreshToken = crypto.randomBytes(48).toString('hex')
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const refreshExpires = new Date(Date.now() + (process.env.REFRESH_TOKEN_DAYS ? Number(process.env.REFRESH_TOKEN_DAYS) : 30) * 24 * 60 * 60 * 1000)
    await pool.query('UPDATE players SET refresh_token_hash = ?, refresh_token_expires = ? WHERE id = ?', [refreshHash, refreshExpires, userId])

    res.status(201).json({
      token,
      refreshToken,
      user: { id: userId, name, email, phone, sex: sex || 'M', quota_18: normalizedQuota18, quota_9: normalizedQuota9, role: 'player', league_id: targetLeague.id }
    });
  } catch (err) {
    console.error('Registration error', err);

    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (err && (err.code === 'ER_BAD_NULL_ERROR' || err.code === 'ER_NO_REFERENCED_ROW_2')) {
      return res.status(400).json({ error: 'Selected league is not configured for registration yet' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/refresh { refreshToken }
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken || typeof refreshToken !== 'string') return res.status(400).json({ error: 'refreshToken is required' })

  try {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.email, p.sex, p.active, lp.quota_18, lp.quota_9, p.role, p.password
       FROM players p
       LEFT JOIN league_players lp ON lp.player_id = p.id AND lp.league_id = ?
       WHERE p.refresh_token_hash = ? AND p.refresh_token_expires > NOW()
       LIMIT 1`,
      [req.league?.id ?? null, hash]
    )
    const user = rows && rows[0]
    if (!user || Number(user.active) === 0) return res.status(401).json({ error: 'invalid or expired refresh token' })

    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'server misconfigured' })

    const token = signAccessToken(user, secret, jwtExpiresIn)

    // rotate refresh token
    const newRefreshToken = crypto.randomBytes(48).toString('hex')
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex')
    const refreshExpires = new Date(Date.now() + (process.env.REFRESH_TOKEN_DAYS ? Number(process.env.REFRESH_TOKEN_DAYS) : 30) * 24 * 60 * 60 * 1000)
    await pool.query('UPDATE players SET refresh_token_hash = ?, refresh_token_expires = ? WHERE id = ?', [newHash, refreshExpires, user.id])

    res.json({ token, refreshToken: newRefreshToken, user: { id: user.id, name: user.name, email: user.email, sex: user.sex, active: user.active, quota_18: user.quota_18, quota_9: user.quota_9, role: user.role } })
  } catch (err) {
    console.error('Refresh token error', err)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
})

// POST /api/auth/logout { refreshToken }
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.json({ message: 'ok' })

  try {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await pool.query('UPDATE players SET refresh_token_hash = NULL, refresh_token_expires = NULL WHERE refresh_token_hash = ?', [hash])
    res.json({ message: 'logged out' })
  } catch (err) {
    console.error('Logout error', err)
    res.status(500).json({ error: 'Failed to logout' })
  }
})

// POST /api/auth/forgot-password { email }
router.post('/forgot-password', limitByIp(forgotIpLimit), async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email is required' });

  // Same answer whether or not an email goes out, so this doesn't reveal accounts.
  const sentMessage = { message: 'If an account exists for that email, a reset link has been sent.' };
  const emailKey = email.trim().toLowerCase().slice(0, 255);
  if (forgotEmailLimit.blockedFor(emailKey)) return res.json(sentMessage);
  forgotEmailLimit.hit(emailKey);

  try {
    const [rows] = await pool.query('SELECT id, name, email FROM players WHERE LOWER(email) = LOWER(?) AND COALESCE(active, 1) <> 0 LIMIT 1', [email.trim()]);
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
        <p>Hello ${escapeHtml(user.name)},</p>
        <p>We received a request to reset your NPGOLF password.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `;
      const text = `Hello ${user.name || ''},\n\nWe received a request to reset your NPGOLF password.\n\nReset your password: ${resetLink}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore this email.`;

      try {
        const emailDelayMs = getOutgoingEmailDelayMs();
        if (emailDelayMs > 0) {
          await sleep(emailDelayMs);
        }
        await sendEmail(user.email, subject, html, text);
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr.message);
      }
    }

    return res.json(sentMessage);
  } catch (err) {
    console.error('Forgot password error', err);
    return res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// POST /api/auth/reset-password { token, password }
router.post('/reset-password', limitByIp(resetLimit), async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || typeof token !== 'string' || !password) return res.status(400).json({ error: 'token and password are required' });
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include letters and numbers' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
      'SELECT id FROM players WHERE reset_password_token_hash = ? AND reset_password_expires > NOW() AND COALESCE(active, 1) <> 0 LIMIT 1',
      [tokenHash]
    );

    const user = rows && rows[0];
    if (!user) {
      return res.status(400).json({ error: 'invalid or expired reset token' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashedPassword = await bcrypt.hash(password, rounds);

    // Clearing the refresh token (and the new password fingerprint) ends every open session.
    await pool.query(
      'UPDATE players SET password = ?, reset_password_token_hash = NULL, reset_password_expires = NULL, refresh_token_hash = NULL, refresh_token_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
module.exports.resetAuthLimits = resetAuthLimits;
module.exports.isPlausibleName = isPlausibleName;
