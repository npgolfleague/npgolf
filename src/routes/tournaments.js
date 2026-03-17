const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendSMS } = require('../twilio');
const { sendEmail } = require('../email');

const formatDateOnly = (value, locale = 'en-US', options = {}) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(locale, options);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString(locale, options);
};

// GET /api/tournaments - List all tournaments
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       ORDER BY t.date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// GET /api/tournaments/upcoming - Get next 3 upcoming tournaments
router.get('/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.date >= CURDATE()
       ORDER BY t.date ASC
       LIMIT 3`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching upcoming tournaments:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming tournaments' });
  }
});
// GET /api/tournaments/next - Get next upcoming tournament
router.get('/next', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.course_id, t.number_of_holes, t.first_tee_time, t.created_at,
              c.name as course_name, c.address as course_address, c.phone as course_phone
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.date >= CURDATE()
       ORDER BY t.date ASC
       LIMIT 1`
    );
    if (rows.length === 0) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching next tournament:', err);
    res.status(500).json({ error: 'Failed to fetch next tournament' });
  }
});
// GET /api/tournaments/:id - Get single tournament
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.date, t.number_of_holes, t.created_at,
              c.id as course_id, c.name as course_name, c.address as course_address, c.phone as course_phone
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching tournament:', err);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// POST /api/tournaments - Create tournament
router.post('/', async (req, res) => {
  try {
    const { date, course_id, number_of_holes } = req.body;
    const [result] = await pool.query(
      'INSERT INTO tournament (date, course_id, number_of_holes) VALUES (?, ?, ?)',
      [date, course_id, number_of_holes || 18]
    );
    res.status(201).json({ id: result.insertId, date, course_id, number_of_holes: number_of_holes || 18 });
  } catch (err) {
    console.error('Error creating tournament:', err);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// PUT /api/tournaments/:id - Update tournament
router.put('/:id', async (req, res) => {
  try {
    const { date, course_id, number_of_holes } = req.body;
    await pool.query(
      'UPDATE tournament SET date = ?, course_id = ?, number_of_holes = ? WHERE id = ?',
      [date, course_id, number_of_holes, req.params.id]
    );
    res.json({ id: req.params.id, date, course_id, number_of_holes });
  } catch (err) {
    console.error('Error updating tournament:', err);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// DELETE /api/tournaments/:id - Delete tournament
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tournament WHERE id = ?', [req.params.id]);
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    console.error('Error deleting tournament:', err);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

// POST /api/tournaments/:id/complete - Complete tournament and update quota history
router.post('/:id/complete', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const tournamentId = req.params.id;
    
    // Get tournament date
    const [tournamentRows] = await connection.query(
      'SELECT date FROM tournament WHERE id = ?',
      [tournamentId]
    );
    
    if (tournamentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournamentDate = tournamentRows[0].date;
    
    // Get all players who participated in this tournament with their scores
    const [scoresRows] = await connection.query(
      `SELECT s.player_id, p.quota, SUM(CAST(s.score AS SIGNED) - CAST(s.quota AS SIGNED)) as total_points
       FROM scores s
       JOIN players p ON s.player_id = p.id
       WHERE s.tournament_id = ?
       GROUP BY s.player_id, p.quota`,
      [tournamentId]
    );
    
    if (scoresRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No scores found for this tournament' });
    }
    
    // For each player, shift quota history and add new result
    for (const player of scoresRows) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const quotaDiff = totalPoints; // positive = above quota, negative = below
      
      // Get current quota record for this player
      const [quotaRows] = await connection.query(
        'SELECT * FROM quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      
      if (quotaRows.length === 0) {
        // Create new quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO quota (player_id, date_1, points_1, quota_diff_1)
           VALUES (?, ?, ?, ?)`,
          [playerId, tournamentDate, totalPoints, quotaDiff]
        );
      } else {
        // Shift existing data and insert new tournament result
        const quota = quotaRows[0];
        await connection.query(
          `UPDATE quota SET
            date_7 = ?, points_7 = ?, quota_diff_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?
           WHERE player_id = ?`,
          [
            quota.date_6, quota.points_6, quota.quota_diff_6,
            quota.date_5, quota.points_5, quota.quota_diff_5,
            quota.date_4, quota.points_4, quota.quota_diff_4,
            quota.date_3, quota.points_3, quota.quota_diff_3,
            quota.date_2, quota.points_2, quota.quota_diff_2,
            quota.date_1, quota.points_1, quota.quota_diff_1,
            tournamentDate, totalPoints, quotaDiff,
            playerId
          ]
        );
      }
    }
    
    // Now do the same for skins_quota (20 slots instead of 7)
    for (const player of scoresRows) {
      const playerId = player.player_id;
      const totalPoints = player.total_points;
      const quotaDiff = totalPoints;
      
      // Get current skins_quota record for this player
      const [skinsQuotaRows] = await connection.query(
        'SELECT * FROM skins_quota WHERE player_id = ? LIMIT 1',
        [playerId]
      );
      
      if (skinsQuotaRows.length === 0) {
        // Create new skins_quota record with tournament result in slot 1
        await connection.query(
          `INSERT INTO skins_quota (player_id, date_1, points_1, quota_diff_1)
           VALUES (?, ?, ?, ?)`,
          [playerId, tournamentDate, totalPoints, quotaDiff]
        );
      } else {
        // Shift existing data: 19->20, 18->19, ..., 1->2, and new->1
        const sq = skinsQuotaRows[0];
        await connection.query(
          `UPDATE skins_quota SET
            date_20 = ?, points_20 = ?, quota_diff_20 = ?,
            date_19 = ?, points_19 = ?, quota_diff_19 = ?,
            date_18 = ?, points_18 = ?, quota_diff_18 = ?,
            date_17 = ?, points_17 = ?, quota_diff_17 = ?,
            date_16 = ?, points_16 = ?, quota_diff_16 = ?,
            date_15 = ?, points_15 = ?, quota_diff_15 = ?,
            date_14 = ?, points_14 = ?, quota_diff_14 = ?,
            date_13 = ?, points_13 = ?, quota_diff_13 = ?,
            date_12 = ?, points_12 = ?, quota_diff_12 = ?,
            date_11 = ?, points_11 = ?, quota_diff_11 = ?,
            date_10 = ?, points_10 = ?, quota_diff_10 = ?,
            date_9 = ?, points_9 = ?, quota_diff_9 = ?,
            date_8 = ?, points_8 = ?, quota_diff_8 = ?,
            date_7 = ?, points_7 = ?, quota_diff_7 = ?,
            date_6 = ?, points_6 = ?, quota_diff_6 = ?,
            date_5 = ?, points_5 = ?, quota_diff_5 = ?,
            date_4 = ?, points_4 = ?, quota_diff_4 = ?,
            date_3 = ?, points_3 = ?, quota_diff_3 = ?,
            date_2 = ?, points_2 = ?, quota_diff_2 = ?,
            date_1 = ?, points_1 = ?, quota_diff_1 = ?
           WHERE player_id = ?`,
          [
            sq.date_19, sq.points_19, sq.quota_diff_19,
            sq.date_18, sq.points_18, sq.quota_diff_18,
            sq.date_17, sq.points_17, sq.quota_diff_17,
            sq.date_16, sq.points_16, sq.quota_diff_16,
            sq.date_15, sq.points_15, sq.quota_diff_15,
            sq.date_14, sq.points_14, sq.quota_diff_14,
            sq.date_13, sq.points_13, sq.quota_diff_13,
            sq.date_12, sq.points_12, sq.quota_diff_12,
            sq.date_11, sq.points_11, sq.quota_diff_11,
            sq.date_10, sq.points_10, sq.quota_diff_10,
            sq.date_9, sq.points_9, sq.quota_diff_9,
            sq.date_8, sq.points_8, sq.quota_diff_8,
            sq.date_7, sq.points_7, sq.quota_diff_7,
            sq.date_6, sq.points_6, sq.quota_diff_6,
            sq.date_5, sq.points_5, sq.quota_diff_5,
            sq.date_4, sq.points_4, sq.quota_diff_4,
            sq.date_3, sq.points_3, sq.quota_diff_3,
            sq.date_2, sq.points_2, sq.quota_diff_2,
            sq.date_1, sq.points_1, sq.quota_diff_1,
            tournamentDate, totalPoints, quotaDiff,
            playerId
          ]
        );
      }
    }
    
    await connection.commit();
    res.json({ message: 'Tournament completed successfully', playersUpdated: scoresRows.length });
    
  } catch (err) {
    await connection.rollback();
    console.error('Error completing tournament:', err);
    res.status(500).json({ error: 'Failed to complete tournament' });
  } finally {
    connection.release();
  }
});

// POST /api/tournaments/:id/invite-sms - Send SMS invite to all active players
router.post('/:id/invite-sms', async (req, res) => {
  const tournamentId = req.params.id;
  try {
    // Get tournament info
    const [tournamentRows] = await pool.query('SELECT id, date FROM tournament WHERE id = ?', [tournamentId]);
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get all active players with sms_allowed and phone
    const [players] = await pool.query('SELECT id, name, phone FROM players WHERE active = 1 AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""');
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players with SMS allowed and phone numbers' });
    }
    
    // Send SMS to each player
    let sent = 0, failed = [];
    for (const player of players) {
      // Generate unique link for each player
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const joinUrl = `${baseUrl}/api/tournaments/join?playerId=${player.id}&tournamentId=${tournamentId}`;
      const msg = `Hi ${player.name}, are you playing in the next tournament? Tap to join: ${joinUrl}`;
      try {
        await sendSMS(player.phone, msg);
        sent++;
      } catch (err) {
        failed.push({ id: player.id, phone: player.phone, error: err.message });
      }
    }
    res.json({ sent, failed });
  } catch (err) {
    console.error('Error sending SMS invites:', err);
    res.status(500).json({ error: 'Failed to send SMS invites' });
  }
});

// POST /api/tournaments/:id/send-sms - Send custom SMS announcement to all active players
router.post('/:id/send-sms', async (req, res) => {
  const tournamentId = req.params.id;
  try {
    // Get tournament info with course details
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Get all active players with sms_allowed and phone
    const [players] = await pool.query(
      'SELECT id, name, phone FROM players WHERE active = 1 AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""'
    );
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players with SMS allowed and phone numbers' });
    }
    
    // Get base URL for RSVP links
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.4.111:3000';
    
    // Send SMS to each player with personalized RSVP link
    let sent = 0, failed = [];
    
    for (const player of players) {
      try {
        const rsvpLink = `${baseUrl}/api/tournaments/${tournamentId}/rsvp?playerId=${player.id}`;
        const message = `If you are playing ${tournament.course_name} ${tournamentDate} click this link ${rsvpLink}`;
        console.log(`Sending SMS to ${player.name} (${player.phone}): ${message}`);
        await sendSMS(player.phone, message);
        console.log(`✓ SMS sent successfully to ${player.name}`);
        sent++;
      } catch (err) {
        console.error(`✗ Failed to send SMS to ${player.name} (${player.phone}): ${err.message}`);
        failed.push({ id: player.id, phone: player.phone, error: err.message });
      }
    }
    
    const sampleMessage = `If you are playing ${tournament.course_name} ${tournamentDate} click this link ${baseUrl}/api/tournaments/${tournamentId}/rsvp?playerId={playerId}`;
    res.json({ sent, failed, message: sampleMessage });
  } catch (err) {
    console.error('Error sending SMS announcement:', err);
    res.status(500).json({ error: 'Failed to send SMS announcement' });
  }
});

// POST /api/tournaments/:id/send-invitations - Send tournament invitations via SMS and/or Email
router.post('/:id/send-invitations', async (req, res) => {
  const tournamentId = req.params.id;
  const { method } = req.body; // 'sms', 'email', or 'both'
  
  try {
    // Get tournament info with course details
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name, c.address as course_address
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Get base URL for RSVP links
    const baseUrl = process.env.APP_BASE_URL || 'http://192.168.4.111:3000';
    
    // Query players based on method
    let playersQuery = '';
    if (method === 'sms' || !method) {
      playersQuery = 'SELECT id, name, phone, email FROM players WHERE active = 1 AND sms_allowed = 1 AND phone IS NOT NULL AND phone != ""';
    } else if (method === 'email') {
      playersQuery = 'SELECT id, name, phone, email FROM players WHERE active = 1 AND email_allowed = 1 AND email IS NOT NULL AND email != ""';
    } else if (method === 'both') {
      playersQuery = 'SELECT id, name, phone, email FROM players WHERE active = 1 AND ((sms_allowed = 1 AND phone IS NOT NULL AND phone != "") OR (email_allowed = 1 AND email IS NOT NULL AND email != ""))';
    } else {
      return res.status(400).json({ error: 'Invalid method. Use "sms", "email", or "both"' });
    }
    
    const [players] = await pool.query(playersQuery);
    if (players.length === 0) {
      return res.status(400).json({ error: 'No active players found with the selected contact method' });
    }
    
    let smsSent = 0, emailSent = 0, smsFailed = [], emailFailed = [];
    
    for (const player of players) {
      const yesUrl = `${baseUrl}/api/tournaments/${tournamentId}/confirm?playerId=${player.id}&response=yes`;
      const noUrl = `${baseUrl}/api/tournaments/${tournamentId}/confirm?playerId=${player.id}&response=no`;
      
      // Send SMS if applicable
      if ((method === 'sms' || method === 'both') && player.phone) {
        try {
          const smsMessage = `Hi ${player.name}! Are you playing ${tournament.course_name} on ${tournamentDate}?\n\nYes: ${yesUrl}\nNo: ${noUrl}`;
          console.log(`Sending SMS to ${player.name} (${player.phone})`);
          await sendSMS(player.phone, smsMessage);
          console.log(`✓ SMS sent successfully to ${player.name}`);
          smsSent++;
        } catch (err) {
          console.error(`✗ Failed to send SMS to ${player.name}: ${err.message}`);
          smsFailed.push({ id: player.id, name: player.name, phone: player.phone, error: err.message });
        }
      }
      
      // Send Email if applicable
      if ((method === 'email' || method === 'both') && player.email) {
        try {
          const subject = `Tournament Invitation - ${tournament.course_name}`;
          const html = `
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                  .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                  .button { display: inline-block; padding: 12px 30px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                  .btn-yes { background-color: #4CAF50; color: white; }
                  .btn-no { background-color: #f44336; color: white; }
                  .details { background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #4CAF50; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🏌️ Tournament Invitation</h1>
                  </div>
                  <div class="content">
                    <p>Hi ${player.name},</p>
                    <p>We're organizing a tournament and would like to know if you'll be joining us!</p>
                    
                    <div class="details">
                      <strong>📍 Course:</strong> ${tournament.course_name}<br>
                      <strong>📅 Date:</strong> ${tournamentDate}<br>
                      ${tournament.course_address ? `<strong>🗺️ Location:</strong> ${tournament.course_address}<br>` : ''}
                    </div>
                    
                    <p><strong>Will you be playing?</strong></p>
                    <p style="text-align: center;">
                      <a href="${yesUrl}" class="button btn-yes">✓ Yes, I'll Play</a>
                      <a href="${noUrl}" class="button btn-no">✗ Can't Make It</a>
                    </p>
                    
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                      Looking forward to seeing you on the course!
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `;
          
          console.log(`Sending Email to ${player.name} (${player.email})`);
          await sendEmail(player.email, subject, html);
          console.log(`✓ Email sent successfully to ${player.name}`);
          emailSent++;
        } catch (err) {
          console.error(`✗ Failed to send Email to ${player.name}: ${err.message}`);
          emailFailed.push({ id: player.id, name: player.name, email: player.email, error: err.message });
        }
      }
    }
    
    res.json({ 
      sms: { sent: smsSent, failed: smsFailed },
      email: { sent: emailSent, failed: emailFailed },
      total: players.length
    });
  } catch (err) {
    console.error('Error sending tournament invitations:', err);
    res.status(500).json({ error: 'Failed to send tournament invitations' });
  }
});

// GET /api/tournaments/:id/confirm - Confirm attendance (yes/no) via link
router.get('/:id/confirm', async (req, res) => {
  const tournamentId = req.params.id;
  const { playerId, response } = req.query;
  
  console.log(`Confirmation request received: tournamentId=${tournamentId}, playerId=${playerId}, response=${response}`);
  
  try {
    if (!playerId || !response) {
      console.log('Error: Missing playerId or response');
      return res.status(400).send('<h1>Error: Missing information</h1>');
    }
    
    if (response !== 'yes' && response !== 'no') {
      console.log('Error: Invalid response value');
      return res.status(400).send('<h1>Error: Invalid response</h1>');
    }
    
    // Verify tournament exists
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).send('<h1>Tournament not found</h1>');
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Verify player exists
    const [playerRows] = await pool.query('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    const player = playerRows[0];
    
    // Check if player is already registered
    const [exists] = await pool.query(
      'SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?',
      [playerId, tournamentId]
    );
    
    if (response === 'yes') {
      // Add player to tournament if not already registered
      if (exists.length === 0) {
        await pool.query(
          'INSERT INTO tournament_players (player_id, tournament_id, attending_status, response_date) VALUES (?, ?, ?, NOW())',
          [playerId, tournamentId, 'yes']
        );
        console.log(`Inserted new tournament_players record: player ${playerId} ATTENDING tournament ${tournamentId}`);
      } else {
        // Update attending status
        await pool.query(
          'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
          ['yes', playerId, tournamentId]
        );
        console.log(`Updated tournament_players: player ${playerId} ATTENDING tournament ${tournamentId}`);
      }
      
      // Send success response
      res.send(`
        <html>
          <head>
            <title>Confirmed - See You There!</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f8f0;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #4CAF50;">✓ You're In!</h1>
              <p style="font-size: 18px;">Thanks <strong>${player.name}</strong>!</p>
              <p style="font-size: 16px;">You're registered for:</p>
              <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <p style="margin: 5px 0;"><strong>${tournament.course_name}</strong></p>
                <p style="margin: 5px 0;">${tournamentDate}</p>
              </div>
              <p style="margin-top: 30px; color: #666;">See you on the course! 🏌️</p>
            </div>
          </body>
        </html>
      `);
    } else {
      // response === 'no'
      if (exists.length === 0) {
        // Add record with 'no' status
        await pool.query(
          'INSERT INTO tournament_players (player_id, tournament_id, attending_status, response_date) VALUES (?, ?, ?, NOW())',
          [playerId, tournamentId, 'no']
        );
        console.log(`Inserted new tournament_players record: player ${playerId} NOT ATTENDING tournament ${tournamentId}`);
      } else {
        // Update status to 'no'
        await pool.query(
          'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
          ['no', playerId, tournamentId]
        );
        console.log(`Updated tournament_players: player ${playerId} NOT ATTENDING tournament ${tournamentId}`);
      }
      
      // Send acknowledgment response
      res.send(`
        <html>
          <head>
            <title>Response Recorded</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #fff5f5;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #666;">Thanks for Letting Us Know</h1>
              <p style="font-size: 18px;">Hi <strong>${player.name}</strong>,</p>
              <p style="font-size: 16px;">We've recorded that you won't be able to make it to:</p>
              <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #999;">
                <p style="margin: 5px 0;"><strong>${tournament.course_name}</strong></p>
                <p style="margin: 5px 0;">${tournamentDate}</p>
              </div>
              <p style="margin-top: 30px; color: #666;">Hope to see you at the next one!</p>
            </div>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('Error processing confirmation:', err);
    res.status(500).send('<h1>Error processing your response. Please contact the administrator.</h1>');
  }
});

// GET /api/tournaments/:id/rsvp - RSVP to a tournament via SMS link
router.get('/:id/rsvp', async (req, res) => {
  const tournamentId = req.params.id;
  const { playerId } = req.query;
  
  try {
    if (!playerId) {
      return res.status(400).send('<h1>Error: Missing player information</h1>');
    }
    
    // Verify tournament exists
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).send('<h1>Tournament not found</h1>');
    }
    
    const tournament = tournamentRows[0];
    const tournamentDate = formatDateOnly(tournament.date, 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Verify player exists
    const [playerRows] = await pool.query('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (playerRows.length === 0) {
      return res.status(404).send('<h1>Player not found</h1>');
    }
    const player = playerRows[0];
    
    // Check if already registered
    const [exists] = await pool.query(
      'SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?',
      [playerId, tournamentId]
    );
    
    if (exists.length > 0) {
      // Update attending status if already exists
      await pool.query(
        'UPDATE tournament_players SET attending_status = ?, response_date = NOW() WHERE player_id = ? AND tournament_id = ?',
        ['yes', playerId, tournamentId]
      );
      
      return res.send(`
        <html>
          <head><title>Already Registered</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>✓ Already Registered</h1>
            <p><strong>${player.name}</strong>, you're already registered for:</p>
            <p><strong>${tournament.course_name}</strong></p>
            <p>${tournamentDate}</p>
            <p style="margin-top: 30px; color: #666;">See you on the course!</p>
          </body>
        </html>
      `);
    }
    
    // Add player to tournament
    await pool.query(
      'INSERT INTO tournament_players (player_id, tournament_id, paid, attending_status, response_date) VALUES (?, ?, 0, ?, NOW())',
      [playerId, tournamentId, 'yes']
    );
    
    // Send success response
    res.send(`
      <html>
        <head><title>Registration Confirmed</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>✓ Registration Confirmed!</h1>
          <p>Thanks <strong>${player.name}</strong>!</p>
          <p>You're registered for:</p>
          <p><strong>${tournament.course_name}</strong></p>
          <p>${tournamentDate}</p>
          <p style="margin-top: 30px; color: #666;">See you on the course!</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing RSVP:', err);
    res.status(500).send('<h1>Error processing your registration. Please contact the administrator.</h1>');
  }
});

// GET /api/tournaments/:id/attendance - Get attendance statistics for a tournament
router.get('/:id/attendance', async (req, res) => {
  const tournamentId = req.params.id;
  
  try {
    // Get tournament info
    const [tournamentRows] = await pool.query(
      `SELECT t.id, t.date, c.name as course_name 
       FROM tournament t
       JOIN course c ON t.course_id = c.id
       WHERE t.id = ?`,
      [tournamentId]
    );
    if (tournamentRows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Get attendance summary
    const [summary] = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN attending_status = 'yes' THEN 1 ELSE 0 END) as confirmed_yes,
        SUM(CASE WHEN attending_status = 'no' THEN 1 ELSE 0 END) as confirmed_no,
        SUM(CASE WHEN attending_status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM tournament_players
       WHERE tournament_id = ?`,
      [tournamentId]
    );
    
    // Get player details grouped by response
    const [playersYes] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone, tp.response_date
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'yes'
       ORDER BY tp.response_date DESC`,
      [tournamentId]
    );
    
    const [playersNo] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone, tp.response_date
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'no'
       ORDER BY tp.response_date DESC`,
      [tournamentId]
    );
    
    const [playersPending] = await pool.query(
      `SELECT p.id, p.name, p.email, p.phone
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.attending_status = 'pending'
       ORDER BY p.name ASC`,
      [tournamentId]
    );
    
    res.json({
      tournament: tournamentRows[0],
      summary: summary[0],
      players: {
        confirmed_yes: playersYes,
        confirmed_no: playersNo,
        pending: playersPending
      }
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// GET /api/tournaments/join - Add player to tournament via link
router.get('/join', async (req, res) => {
  const { playerId, tournamentId } = req.query;
  try {
    if (!playerId || !tournamentId) {
      return res.status(400).json({ error: 'Missing playerId or tournamentId' });
    }
    
    // Check if already joined
    const [exists] = await pool.query('SELECT * FROM tournament_players WHERE player_id = ? AND tournament_id = ?', [playerId, tournamentId]);
    if (exists.length > 0) {
      return res.json({ message: 'Already joined' });
    }
    
    // Add to tournament_players
    await pool.query('INSERT INTO tournament_players (player_id, tournament_id) VALUES (?, ?)', [playerId, tournamentId]);
    res.json({ message: 'Joined tournament successfully' });
  } catch (err) {
    console.error('Error joining tournament:', err);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

module.exports = router;
