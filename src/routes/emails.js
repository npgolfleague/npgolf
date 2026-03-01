const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const upload = multer();

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
