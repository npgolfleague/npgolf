const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/admin');
const { getLeagueId } = require('../utils/league');
const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSemicolonEmails(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const emails = raw
    .split(';')
    .map(v => v.trim())
    .filter(Boolean);

  if (emails.length === 0) return null;

  const invalid = emails.find(email => !EMAIL_REGEX.test(email));
  if (invalid) {
    return { error: `Invalid email address: ${invalid}` };
  }

  return { normalized: emails.join('; ') };
}

function normalizeSingleEmail(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (!EMAIL_REGEX.test(raw)) {
    return { error: `Invalid email address: ${raw}` };
  }

  return { normalized: raw };
}

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    const leagueId = getLeagueId(req);
    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [leagueId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put('/', requireAdmin, async (req, res) => {
  const {
    tournament_fee_18_holes, tournament_fee_9_holes,
    skins_ctp_fee_18_holes, skins_ctp_fee_9_holes,
    golf_course_email,
    outgoing_email_from,
    quota_points_albatross, quota_points_eagle, quota_points_birdie,
    quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse
  } = req.body;

  if (tournament_fee_18_holes === undefined && tournament_fee_9_holes === undefined && 
      skins_ctp_fee_18_holes === undefined && skins_ctp_fee_9_holes === undefined && 
      golf_course_email === undefined &&
      outgoing_email_from === undefined &&
      quota_points_albatross === undefined && quota_points_eagle === undefined &&
      quota_points_birdie === undefined && quota_points_par === undefined &&
      quota_points_bogey === undefined && quota_points_double_bogey === undefined &&
      quota_points_worse === undefined) {
    return res.status(400).json({ error: 'No settings provided to update' });
  }

  const normalizedEmailResult = normalizeSemicolonEmails(golf_course_email);
  if (normalizedEmailResult && normalizedEmailResult.error) {
    return res.status(400).json({ error: normalizedEmailResult.error });
  }
  const normalizedGolfCourseEmail = normalizedEmailResult?.normalized ?? null;

  const normalizedOutgoingFromResult = normalizeSingleEmail(outgoing_email_from);
  if (normalizedOutgoingFromResult && normalizedOutgoingFromResult.error) {
    return res.status(400).json({ error: normalizedOutgoingFromResult.error });
  }
  const normalizedOutgoingEmailFrom = normalizedOutgoingFromResult?.normalized ?? null;

  try {
    const updates = [];
    const values = [];

    if (tournament_fee_18_holes !== undefined) {
      updates.push('tournament_fee_18_holes = ?');
      values.push(tournament_fee_18_holes);
    }

    if (tournament_fee_9_holes !== undefined) {
      updates.push('tournament_fee_9_holes = ?');
      values.push(tournament_fee_9_holes);
    }

    if (skins_ctp_fee_18_holes !== undefined) {
      updates.push('skins_ctp_fee_18_holes = ?');
      values.push(skins_ctp_fee_18_holes);
    }

    if (skins_ctp_fee_9_holes !== undefined) {
      updates.push('skins_ctp_fee_9_holes = ?');
      values.push(skins_ctp_fee_9_holes);
    }

    if (golf_course_email !== undefined) {
      updates.push('golf_course_email = ?');
      values.push(normalizedGolfCourseEmail);
    }

    if (outgoing_email_from !== undefined) {
      updates.push('outgoing_email_from = ?');
      values.push(normalizedOutgoingEmailFrom);
    }

    if (quota_points_albatross !== undefined) { updates.push('quota_points_albatross = ?'); values.push(quota_points_albatross); }
    if (quota_points_eagle !== undefined) { updates.push('quota_points_eagle = ?'); values.push(quota_points_eagle); }
    if (quota_points_birdie !== undefined) { updates.push('quota_points_birdie = ?'); values.push(quota_points_birdie); }
    if (quota_points_par !== undefined) { updates.push('quota_points_par = ?'); values.push(quota_points_par); }
    if (quota_points_bogey !== undefined) { updates.push('quota_points_bogey = ?'); values.push(quota_points_bogey); }
    if (quota_points_double_bogey !== undefined) { updates.push('quota_points_double_bogey = ?'); values.push(quota_points_double_bogey); }
    if (quota_points_worse !== undefined) { updates.push('quota_points_worse = ?'); values.push(quota_points_worse); }

    await pool.query(
      `UPDATE league_settings SET ${updates.join(', ')} WHERE league_id = ?`,
      [...values, getLeagueId(req)]
    );

    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [getLeagueId(req)]);
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
