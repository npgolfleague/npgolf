const express = require('express');
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { sendSMS } = require('../twilio');
const router = express.Router();

// GET /api/users - list players
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota, fedex_points, tournaments_played, prize_money, role, sms_allowed, created_at FROM players WHERE active = 1 ORDER BY fedex_points DESC, name ASC');
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
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, active, quota, sms_allowed, created_at FROM players WHERE id = ?', [insertedId]);
    
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
    if (req.body.sms_allowed !== undefined) { updates.push('sms_allowed = ?'); values.push(req.body.sms_allowed); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const sql = `UPDATE players SET ${updates.join(', ')} WHERE id = ?`;
    
    await pool.execute(sql, values);
    const [rows] = await pool.query('SELECT id, name, email, phone, sex, quota, fedex_points, tournaments_played, prize_money, role, active, sms_allowed, created_at FROM players WHERE id = ?', [id]);
    
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

module.exports = router;
