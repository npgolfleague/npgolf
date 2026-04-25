const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const upload = multer();
const { sendEmail } = require('../email');

// GET /api/emails - Get all received emails (admin only)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, from_email, from_name, to_email, subject, 
              received_at, is_read
       FROM emails
       ORDER BY received_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// GET /api/emails/:id - Get single email
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM emails WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching email:', err);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
});

// PUT /api/emails/:id/read - Mark email as read
router.put('/:id/read', async (req, res) => {
  try {
    const { is_read } = req.body;
    await pool.query(
      'UPDATE emails SET is_read = ? WHERE id = ?',
      [is_read ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Email updated' });
  } catch (err) {
    console.error('Error updating email:', err);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// DELETE /api/emails/:id - Delete email
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM emails WHERE id = ?', [req.params.id]);
    res.json({ message: 'Email deleted' });
  } catch (err) {
    console.error('Error deleting email:', err);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// POST /api/emails/send - Send a custom email to players or specific addresses
router.post('/send', upload.single('attachment'), async (req, res) => {
  const { subject, body, recipient_type, player_ids, custom_emails } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

  try {
    let recipients = [];

    if (recipient_type === 'all') {
      const [rows] = await pool.query("SELECT email FROM players WHERE active = 1 AND email IS NOT NULL AND email != '' AND email_allowed = 1");
      recipients = rows.map(r => r.email);
    } else if (recipient_type === 'active') {
      const [rows] = await pool.query("SELECT email FROM players WHERE active = 1 AND email IS NOT NULL AND email != '' AND email_allowed = 1");
      recipients = rows.map(r => r.email);
    } else if (recipient_type === 'specific' && player_ids) {
      const ids = JSON.parse(player_ids);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await pool.query(`SELECT email FROM players WHERE id IN (${placeholders}) AND email IS NOT NULL AND email != ''`, ids);
        recipients = rows.map(r => r.email);
      }
    } else if (recipient_type === 'custom' && custom_emails) {
      recipients = custom_emails.split(/[,;\n]+/).map(e => e.trim()).filter(Boolean);
    }

    if (recipients.length === 0) return res.status(400).json({ error: 'No valid recipients found' });

    const attachments = [];
    if (req.file) {
      attachments.push({
        content: req.file.buffer.toString('base64'),
        filename: req.file.originalname,
        type: req.file.mimetype,
        disposition: 'attachment'
      });
    }

    const htmlBody = body.replace(/\n/g, '<br>');
    let sent = 0, failed = 0;
    for (const email of recipients) {
      try {
        await sendEmail(email, subject, htmlBody, body, attachments.length ? attachments : null);
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${email}:`, e.message);
        failed++;
      }
    }

    res.json({ message: `Sent: ${sent}, Failed: ${failed}`, sent, failed });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// POST /api/emails/inbound - Webhook for SendGrid Inbound Parse
router.post('/inbound', upload.none(), async (req, res) => {
  try {
    console.log('Received inbound email - headers:', req.headers);
    console.log('Received inbound email - body keys:', Object.keys(req.body));
    console.log('Received inbound email - full body:', JSON.stringify(req.body, null, 2));
    
    const {
      from,
      to,
      subject,
      text,
      html
    } = req.body;
    
    // Validate required fields
    if (!from) {
      console.error('Missing required field: from');
      return res.status(400).send('Missing from field');
    }
    
    // Parse from field to extract email and name
    // Format: "Name <email@example.com>" or just "email@example.com"
    let fromEmail = from;
    let fromName = null;
    
    const fromMatch = from.match(/(.+?)\s*<(.+?)>/);
    if (fromMatch) {
      fromName = fromMatch[1].trim();
      fromEmail = fromMatch[2].trim();
    }
    
    await pool.query(
      `INSERT INTO emails (from_email, from_name, to_email, subject, text, html)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fromEmail, fromName, to || '', subject || '(No subject)', text || '', html || '']
    );
    
    console.log('Email stored successfully');
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error processing inbound email:', err);
    res.status(500).send('Error processing email');
  }
});

module.exports = router;
