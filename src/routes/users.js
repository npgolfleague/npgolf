const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendSMS } = require('../twilio');
const router = express.Router();

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

// GET /api/users - list players
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota_18, quota_9, fedex_points, tournaments_played, prize_money, role, active, sms_allowed, email_allowed, created_at FROM players ORDER BY fedex_points DESC, name ASC');
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/users - create player { name, email, password?, phone?, sex?, active?, quota_18?, quota_9? }
// If `password` is provided it will be hashed before storing. Password is nullable
// to preserve backwards compatibility.
router.post('/', async (req, res) => {
  const { name, email, password, phone, sex, active, quota_18, quota_9 } = req.body;
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
      'INSERT INTO players (name, email, phone, sex, active, quota_18, quota_9, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, sex || null, activeValue, quota_18 || null, quota_9 || null, hashed]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, active, quota_18, quota_9, sms_allowed, email_allowed, created_at FROM players WHERE id = ?', [insertedId]);
    
    // Send SMS opt-in message if phone number is provided
    if (phone) {
      try {
        const baseUrl = process.env.APP_BASE_URL || 'http://192.168.4.111:3000';
        const optInLink = `${baseUrl}/api/players/${insertedId}/sms-opt-in`;
        const message = `Click on this link ${optInLink} to authorize receiving text messages - opt out anytime by replying with 'STOP' to any text message`;
        console.log(`Sending SMS opt-in to new player ${name} (${phone}): ${message}`);
        await sendSMS(phone, message);
        console.log(`✓ SMS opt-in sent successfully to ${name}`);
      } catch (smsErr) {
        console.error(`✗ Failed to send SMS opt-in to ${name} (${phone}):`, smsErr.message);
        // Don't fail player creation if SMS fails
      }
    }
    
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

// POST /api/users/refresh-quotas - Refresh players quota_18/quota_9 from latest quota history (admin only)
router.post('/refresh-quotas', requireAdmin, async (_req, res) => {
  try {
    const [quotaRows] = await pool.query('SELECT * FROM quota');

    let updated18 = 0;
    let updated9 = 0;
    let playersTouched = 0;

    for (const quotaRow of quotaRows) {
      let latest18 = null;
      let latest9 = null;

      for (let i = 1; i <= 7; i++) {
        const holes = Number(quotaRow[`holes_${i}`]);
        const pointsRaw = quotaRow[`points_${i}`];
        if (pointsRaw === null || pointsRaw === undefined || pointsRaw === '') {
          continue;
        }

        const points = Number(pointsRaw);
        if (Number.isNaN(points)) {
          continue;
        }

        if (holes === 18 && latest18 === null) {
          latest18 = Math.round(points);
        }

        if (holes === 9 && latest9 === null) {
          latest9 = Math.round(points);
        }

        if (latest18 !== null && latest9 !== null) {
          break;
        }
      }

      if (latest18 === null && latest9 === null) {
        continue;
      }

      const updates = [];
      const values = [];

      if (latest18 !== null) {
        updates.push('quota_18 = ?');
        values.push(latest18);
        updated18++;
      }

      if (latest9 !== null) {
        updates.push('quota_9 = ?');
        values.push(latest9);
        updated9++;
      }

      values.push(quotaRow.player_id);

      await pool.execute(
        `UPDATE players SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      playersTouched++;
    }

    res.json({
      message: 'Quota values refreshed successfully',
      playersTouched,
      updated18,
      updated9
    });
  } catch (err) {
    console.error('Error refreshing quota values:', err);
    res.status(500).json({ error: 'Failed to refresh quota values' });
  }
});

// PUT /api/users/:id - update player
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, sex, quota_18, quota_9, fedex_points, tournaments_played, prize_money, active, role } = req.body;
  
  try {
    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (sex !== undefined) { updates.push('sex = ?'); values.push(sex); }
    if (quota_18 !== undefined) { updates.push('quota_18 = ?'); values.push(quota_18); }
    if (quota_9 !== undefined) { updates.push('quota_9 = ?'); values.push(quota_9); }
    if (fedex_points !== undefined) { updates.push('fedex_points = ?'); values.push(fedex_points); }
    if (tournaments_played !== undefined) { updates.push('tournaments_played = ?'); values.push(tournaments_played); }
    if (prize_money !== undefined) { updates.push('prize_money = ?'); values.push(prize_money); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (req.body.sms_allowed !== undefined) { updates.push('sms_allowed = ?'); values.push(req.body.sms_allowed); }
    if (req.body.email_allowed !== undefined) { updates.push('email_allowed = ?'); values.push(req.body.email_allowed); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?`;
    
    await pool.execute(sql, values);
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota_18, quota_9, fedex_points, tournaments_played, prize_money, role, active, sms_allowed, email_allowed, created_at FROM players WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/users/:id/sms-opt-in - Opt in to SMS notifications
router.get('/:id/sms-opt-in', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get player info
    const [playerRows] = await pool.query('SELECT id, name, phone, sms_allowed FROM players WHERE id = ?', [id]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    
    const player = playerRows[0];
    
    // Check if already opted in
    if (player.sms_allowed) {
      return res.send(`
        <html>
          <head><title>Already Opted In</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>✓ Already Opted In</h1>
            <p>Hi <strong>${player.name}</strong>,</p>
            <p>You're already receiving text messages.</p>
            <p style="margin-top: 30px; color: #666;">Reply 'STOP' to any message to opt out.</p>
          </body>
        </html>
      `);
    }
    
    // Update sms_allowed flag
    await pool.execute('UPDATE players SET sms_allowed = 1 WHERE id = ?', [id]);
    console.log(`Player ${player.name} (${id}) opted in to SMS notifications`);
    
    // Send confirmation
    res.send(`
      <html>
        <head><title>SMS Opt-In Confirmed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✓ SMS Notifications Enabled!</h1>
          <p>Thanks <strong>${player.name}</strong>!</p>
          <p>You'll now receive tournament notifications and updates via text message.</p>
          <p style="margin-top: 30px; color: #666;">
            You can opt out at any time by replying 'STOP' to any message.
          </p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing SMS opt-in:', err);
    res.status(500).send('<h1>Error processing your request. Please contact the administrator.</h1>');
  }
});

// GET /api/users/:id/email-opt-in - Opt in to email notifications
router.get('/:id/email-opt-in', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get player info
    const [playerRows] = await pool.query('SELECT id, name, email, email_allowed FROM players WHERE id = ?', [id]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    
    const player = playerRows[0];
    
    // Check if already opted in
    if (player.email_allowed) {
      return res.send(`
        <html>
          <head>
            <title>Already Opted In</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f8f0;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #4CAF50;">✓ Already Opted In</h1>
              <p>Hi <strong>${player.name}</strong>,</p>
              <p>You're already receiving email notifications.</p>
              <p style="margin-top: 30px; color: #666;">Contact admin to opt out of emails.</p>
            </div>
          </body>
        </html>
      `);
    }
    
    // Update email_allowed flag
    await pool.execute('UPDATE players SET email_allowed = 1 WHERE id = ?', [id]);
    console.log(`Player ${player.name} (${id}) opted in to email notifications`);
    
    // Send confirmation
    res.send(`
      <html>
        <head>
          <title>Email Opt-In Confirmed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f8f0;">
          <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #4CAF50;">✓ Email Notifications Enabled!</h1>
            <p>Thanks <strong>${player.name}</strong>!</p>
            <p>You'll now receive tournament notifications and updates via email.</p>
            <p style="margin-top: 30px; color: #666;">
              Contact the administrator if you wish to opt out of emails.
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing email opt-in:', err);
    res.status(500).send('<h1>Error processing your request. Please contact the administrator.</h1>');
  }
});

// DELETE /api/users/:id - Delete player and all related data (admin only, permanent delete with cascade)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete from all related tables in the correct order
    // Delete scores first (references player_id, tournament_id, hole_id)
    await connection.execute('DELETE FROM scores WHERE player_id = ?', [id]);
    
    // Delete tournament registrations
    await connection.execute('DELETE FROM tournament_players WHERE player_id = ?', [id]);
    
    // Delete quota records
    await connection.execute('DELETE FROM quota WHERE player_id = ?', [id]);
    
    // Delete skins_quota records
    await connection.execute('DELETE FROM skins_quota WHERE player_id = ?', [id]);
    
    // Finally delete the player
    const [result] = await connection.execute('DELETE FROM players WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Player not found' });
    }

    await connection.commit();
    connection.release();
    
    console.log(`Player ${id} and all related data permanently deleted`);
    res.json({ message: 'Player and all related data deleted successfully' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error deleting player:', err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// POST /api/users/:id/send-sms - Send SMS to a single player (admin only)
router.post('/:id/send-sms', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Get player info
    const [players] = await pool.query('SELECT name, phone, sms_allowed FROM players WHERE id = ?', [id]);
    
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const player = players[0];
    
    if (!player.phone) {
      return res.status(400).json({ error: 'Player has no phone number' });
    }
    
    if (!player.sms_allowed) {
      return res.status(400).json({ error: 'Player has not opted in to SMS' });
    }
    
    // Send SMS
    await sendSMS(player.phone, message);
    console.log(`SMS sent to ${player.name} (${player.phone}): ${message}`);
    
    res.json({ message: 'SMS sent successfully' });
  } catch (err) {
    console.error('Error sending SMS:', err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// POST /api/users/sms-webhook - Handle Twilio SMS status updates (opt-outs)
router.post('/sms-webhook', async (req, res) => {
  const { From, Body, MessageStatus } = req.body;
  
  try {
    // Log the webhook for debugging
    console.log('Twilio SMS webhook received:', { From, Body, MessageStatus });
    
    // Check if user opted out (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
    const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    if (Body && optOutKeywords.includes(Body.toUpperCase().trim())) {
      // Find player by phone number and disable SMS
      const [players] = await pool.query('SELECT id, name FROM players WHERE phone = ?', [From]);
      if (players.length > 0) {
        await pool.execute('UPDATE players SET sms_allowed = 0 WHERE phone = ?', [From]);
        console.log(`Player ${players[0].name} (${From}) opted out of SMS`);
      }
    }
    
    // Respond to Twilio with 200 OK
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error processing SMS webhook:', err);
    res.status(500).send('Error');
  }
});

// GET /api/users/:id/quota-history - Get player's quota history (last 7 rounds)
// GET /api/users/:id/quota - Get player's full quota row
router.get('/:id/quota', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM quota WHERE player_id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.json({ player_id: Number(id) });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching quota row:', err);
    res.status(500).json({ error: 'Failed to fetch quota row' });
  }
});

// PUT /api/users/:id/quota - Update player's quota row
router.put('/:id/quota', async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    'date_1', 'points_1', 'quota_diff_1', 'holes_1',
    'date_2', 'points_2', 'quota_diff_2', 'holes_2',
    'date_3', 'points_3', 'quota_diff_3', 'holes_3',
    'date_4', 'points_4', 'quota_diff_4', 'holes_4',
    'date_5', 'points_5', 'quota_diff_5', 'holes_5',
    'date_6', 'points_6', 'quota_diff_6', 'holes_6',
    'date_7', 'points_7', 'quota_diff_7', 'holes_7'
  ];

  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM quota WHERE player_id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      const columns = ['player_id', ...updates.map(u => u.split(' = ')[0])];
      const placeholders = columns.map(() => '?').join(', ');
      const insertValues = [Number(id), ...values];
      await pool.execute(
        `INSERT INTO quota (${columns.join(', ')}) VALUES (${placeholders})`,
        insertValues
      );
    } else {
      values.push(id);
      await pool.execute(
        `UPDATE quota SET ${updates.join(', ')} WHERE player_id = ?`,
        values
      );
    }

    const [rows] = await pool.query('SELECT * FROM quota WHERE player_id = ? LIMIT 1', [id]);
    res.json(rows[0] || { player_id: Number(id) });
  } catch (err) {
    console.error('Error updating quota row:', err);
    res.status(500).json({ error: 'Failed to update quota row' });
  }
});

// GET /api/users/:id/quota-history - Get player's quota history (last 7 rounds)
router.get('/:id/quota-history', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT date_1, points_1, date_2, points_2, date_3, points_3, 
              date_4, points_4, date_5, points_5, date_6, points_6, 
              date_7, points_7
       FROM quota WHERE player_id = ? LIMIT 1`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.json([]);
    }
    
    const data = rows[0];
    const history = [];
    for (let i = 1; i <= 7; i++) {
      if (data[`date_${i}`] && data[`points_${i}`] !== null) {
        history.push({
          date: data[`date_${i}`],
          points: data[`points_${i}`]
        });
      }
    }
    
    res.json(history);
  } catch (err) {
    console.error('Error fetching quota history:', err);
    res.status(500).json({ error: 'Failed to fetch quota history' });
  }
});

module.exports = router;
