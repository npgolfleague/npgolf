const express = require('express');
const pool = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/admin');
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

function normalizeOptionalText(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw ? raw : null;
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

function ensureLeagueScope(req, res, id) {
  if (!req.league?.id) return true;

  const requestedId = Number(id);
  if (!Number.isInteger(requestedId) || requestedId !== Number(req.league.id)) {
    res.status(403).json({ error: 'Cross-league access is not allowed' });
    return false;
  }

  return true;
}

async function getCurrentLeagueSeasonRow(leagueId) {
  const [rows] = await pool.query(
    `SELECT ls.*
     FROM league_seasons ls
     JOIN leagues l ON l.id = ls.league_id
     WHERE ls.league_id = ?
       AND ls.season_year = COALESCE(l.season_year, YEAR(CURDATE()))
     LIMIT 1`,
    [leagueId]
  );

  return rows[0] || null;
}

async function getLeagueSeasonYear(leagueId) {
  const [rows] = await pool.query('SELECT season_year FROM leagues WHERE id = ? LIMIT 1', [leagueId]);
  return Number(rows[0]?.season_year) || new Date().getFullYear();
}

async function upsertLeagueSeasonPots(leagueId, championshipPot, losersBracketPot) {
  const seasonYear = await getLeagueSeasonYear(leagueId);
  await pool.query(
    `INSERT INTO league_seasons (league_id, season_year, championship_pot, losers_bracket_pot)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       championship_pot = VALUES(championship_pot),
       losers_bracket_pot = VALUES(losers_bracket_pot)`,
    [leagueId, seasonYear, championshipPot ?? 0, losersBracketPot ?? 0]
  );
}

// Get current league from alias context (or sensible default when no alias is present)
router.get('/current', async (req, res) => {
  try {
    if (req.league?.id) {
      const [rows] = await pool.query(
        `SELECT l.*, be.name as billing_entity_name, be.billing_email
         FROM leagues l
         LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
         WHERE l.id = ?
         LIMIT 1`,
        [req.league.id]
      );

      if (rows.length > 0) {
        return res.json(rows[0]);
      }
    }

    const [rows] = await pool.query(
      `SELECT l.*, be.name as billing_entity_name, be.billing_email
       FROM leagues l
       LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
       WHERE l.active = 1
       ORDER BY l.id ASC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No active leagues found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    return res.status(500).json({ error: 'Failed to fetch current league' });
  }
});

// Get league by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ensureLeagueScope(req, res, id)) return;
    
    const [rows] = await pool.query(
      `SELECT l.*, be.name as billing_entity_name, be.billing_email
       FROM leagues l
       LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
       WHERE l.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch league' });
  }
});

// Get all leagues
router.get('/', async (req, res) => {
  try {
    if (req.league?.id) {
      const [scopedRows] = await pool.query(
        `SELECT l.*, be.name as billing_entity_name, be.billing_email
         FROM leagues l
         LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
         WHERE l.id = ?
         ORDER BY l.active DESC, l.season_year DESC, l.name`,
        [req.league.id]
      );

      return res.json(scopedRows);
    }

    const [rows] = await pool.query(
      `SELECT l.*, be.name as billing_entity_name, be.billing_email
       FROM leagues l
       LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
       ORDER BY l.active DESC, l.season_year DESC, l.name`
    );
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// Get league settings
router.get('/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ensureLeagueScope(req, res, id)) return;
    
    const [rows] = await pool.query(
      'SELECT * FROM league_settings WHERE league_id = ? LIMIT 1',
      [id]
    );
    const seasonRow = await getCurrentLeagueSeasonRow(id);
    
    if (rows.length === 0) {
      // Return defaults — settings row will be created on first save
      return res.json({
        league_id: Number(id),
        cup_name: 'Paradise Cup',
        tournament_fee_18_holes: 20.00,
        tournament_fee_9_holes: 10.00,
        skins_ctp_fee_18_holes: 10.00,
        skins_ctp_fee_9_holes: 5.00,
        golf_course_email: null,
        outgoing_email_from: null,
        quota_points_albatross: 8,
        quota_points_eagle: 8,
        quota_points_birdie: 6,
        quota_points_par: 4,
        quota_points_bogey: 2,
        quota_points_double_bogey: 1,
        quota_points_worse: 0,
        live_scoring: 1,
        playoff_format: 'none',
        championship_pot: Number(seasonRow?.championship_pot) || 0,
        losers_bracket_pot: Number(seasonRow?.losers_bracket_pot) || 0,
        season_id: seasonRow?.id || null,
        season_year: Number(seasonRow?.season_year) || await getLeagueSeasonYear(id)
      });
    }
    
    res.json({
      ...rows[0],
      championship_pot: Number(seasonRow?.championship_pot) || 0,
      losers_bracket_pot: Number(seasonRow?.losers_bracket_pot) || 0,
      season_id: seasonRow?.id || null,
      season_year: Number(seasonRow?.season_year) || null
    });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch league settings' });
  }
});

// PUT /api/leagues/:id/settings - Update league settings (admin only)
router.put('/:id/settings', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!ensureLeagueScope(req, res, id)) return;
  const {
    tournament_fee_18_holes, tournament_fee_9_holes,
    skins_ctp_fee_18_holes, skins_ctp_fee_9_holes,
    golf_course_email,
    outgoing_email_from,
    playoff_format,
    championship_pot,
    losers_bracket_pot,
    quota_points_albatross, quota_points_eagle, quota_points_birdie,
    quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse,
    live_scoring
  } = req.body;

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

  const normalizedPlayoffFormat = playoff_format === undefined
    ? undefined
    : String(playoff_format).toLowerCase();
  if (normalizedPlayoffFormat !== undefined && !['none', 'fedex_cup'].includes(normalizedPlayoffFormat)) {
    return res.status(400).json({ error: 'Invalid playoff format' });
  }

  try {
    // Verify league exists
    const [leagueRows] = await pool.query('SELECT id FROM leagues WHERE id = ? LIMIT 1', [id]);
    if (leagueRows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    await pool.query(
      `INSERT INTO league_settings (
        league_id,
        tournament_fee_18_holes, tournament_fee_9_holes,
        skins_ctp_fee_18_holes, skins_ctp_fee_9_holes,
        golf_course_email,
        outgoing_email_from,
        playoff_format,
        quota_points_albatross, quota_points_eagle, quota_points_birdie,
        quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse,
        live_scoring
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tournament_fee_18_holes = VALUES(tournament_fee_18_holes),
        tournament_fee_9_holes = VALUES(tournament_fee_9_holes),
        skins_ctp_fee_18_holes = VALUES(skins_ctp_fee_18_holes),
        skins_ctp_fee_9_holes = VALUES(skins_ctp_fee_9_holes),
        golf_course_email = VALUES(golf_course_email),
        outgoing_email_from = VALUES(outgoing_email_from),
        playoff_format = VALUES(playoff_format),
        quota_points_albatross = VALUES(quota_points_albatross),
        quota_points_eagle = VALUES(quota_points_eagle),
        quota_points_birdie = VALUES(quota_points_birdie),
        quota_points_par = VALUES(quota_points_par),
        quota_points_bogey = VALUES(quota_points_bogey),
        quota_points_double_bogey = VALUES(quota_points_double_bogey),
        quota_points_worse = VALUES(quota_points_worse),
        live_scoring = VALUES(live_scoring)`,
      [
        id,
        tournament_fee_18_holes ?? 20.00, tournament_fee_9_holes ?? 10.00,
        skins_ctp_fee_18_holes ?? 10.00, skins_ctp_fee_9_holes ?? 5.00,
        normalizedGolfCourseEmail,
        normalizedOutgoingEmailFrom,
        normalizedPlayoffFormat ?? 'none',
        quota_points_albatross ?? 8, quota_points_eagle ?? 8, quota_points_birdie ?? 6,
        quota_points_par ?? 4, quota_points_bogey ?? 2, quota_points_double_bogey ?? 1,
        quota_points_worse ?? 0,
        live_scoring != null ? (live_scoring ? 1 : 0) : 1
      ]
    );

    if (championship_pot !== undefined || losers_bracket_pot !== undefined) {
      const currentSeasonRow = await getCurrentLeagueSeasonRow(id);
      await upsertLeagueSeasonPots(
        id,
        championship_pot !== undefined ? Number(championship_pot) || 0 : Number(currentSeasonRow?.championship_pot) || 0,
        losers_bracket_pot !== undefined ? Number(losers_bracket_pot) || 0 : Number(currentSeasonRow?.losers_bracket_pot) || 0
      );
    }

    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [id]);
    const seasonRow = await getCurrentLeagueSeasonRow(id);
    res.json({
      ...rows[0],
      championship_pot: Number(seasonRow?.championship_pot) || 0,
      losers_bracket_pot: Number(seasonRow?.losers_bracket_pot) || 0,
      season_id: seasonRow?.id || null,
      season_year: Number(seasonRow?.season_year) || null
    });
  } catch (err) {
    console.error('Error updating league settings:', err);
    res.status(500).json({ error: 'Failed to update league settings' });
  }
});

router.get('/:id/playoff-overview', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ensureLeagueScope(req, res, id)) return;

    const [settingsRows] = await pool.query(
      'SELECT playoff_format FROM league_settings WHERE league_id = ? LIMIT 1',
      [id]
    );
    const seasonRow = await getCurrentLeagueSeasonRow(id);

    if (!seasonRow) {
      return res.json({
        league_id: Number(id),
        playoff_format: settingsRows[0]?.playoff_format || 'none',
        season_id: null,
        season_year: await getLeagueSeasonYear(id),
        championship_pot: 0,
        losers_bracket_pot: 0,
        champion_player_id: null,
        champion_tiebreak_player_id: null,
        losers_winner_player_id: null,
        standings: [],
        playoff_tournaments: []
      });
    }

    const [standingsRows] = await pool.query(
      `SELECT
         sps.player_id,
         p.name,
         sps.regular_points,
         sps.playoff_points,
         sps.losers_bracket_points,
         (COALESCE(sps.regular_points, 0) + COALESCE(sps.playoff_points, 0) + COALESCE(sps.losers_bracket_points, 0)) AS total_points
       FROM season_player_stats sps
       JOIN players p ON p.id = sps.player_id
       WHERE sps.season_id = ?
       ORDER BY total_points DESC, sps.regular_points DESC, p.name ASC`,
      [seasonRow.id]
    );

    const [playoffTournamentRows] = await pool.query(
      `SELECT
         t.id,
         t.date,
         t.playoff_stage,
         t.completed,
         c.name AS course_name,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM tournament_playoff_points tpp
             WHERE tpp.tournament_id = t.id
           ) THEN 1 ELSE 0
         END AS has_playoff_points
       FROM tournament t
       LEFT JOIN course c ON c.id = t.course_id
       WHERE t.league_id = ?
         AND t.season_id = ?
         AND t.playoff_stage <> 'regular'
       ORDER BY t.date ASC, t.id ASC`,
      [id, seasonRow.id]
    );

    res.json({
      league_id: Number(id),
      playoff_format: settingsRows[0]?.playoff_format || 'none',
      season_id: Number(seasonRow.id),
      season_year: Number(seasonRow.season_year) || await getLeagueSeasonYear(id),
      championship_pot: Number(seasonRow.championship_pot) || 0,
      losers_bracket_pot: Number(seasonRow.losers_bracket_pot) || 0,
      champion_player_id: seasonRow.champion_player_id,
      champion_tiebreak_player_id: seasonRow.champion_tiebreak_player_id,
      losers_winner_player_id: seasonRow.losers_winner_player_id,
      standings: standingsRows.map((row, index) => ({
        rank: index + 1,
        player_id: row.player_id,
        name: row.name,
        regular_points: Number(row.regular_points) || 0,
        playoff_points: Number(row.playoff_points) || 0,
        losers_bracket_points: Number(row.losers_bracket_points) || 0,
        total_points: Number(row.total_points) || 0
      })),
      playoff_tournaments: playoffTournamentRows.map((row) => ({
        id: row.id,
        date: row.date,
        playoff_stage: row.playoff_stage,
        completed: Number(row.completed) === 1,
        course_name: row.course_name,
        has_playoff_points: Number(row.has_playoff_points) === 1
      }))
    });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch playoff overview' });
  }
});

// Get league players
router.get('/:id/players', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ensureLeagueScope(req, res, id)) return;
    
    const [rows] = await pool.query(
      `SELECT p.*, lp.joined_at
       FROM league_players lp
       JOIN players p ON lp.player_id = p.id
       WHERE lp.league_id = ?
       ORDER BY p.name`,
      [id]
    );
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch league players' });
  }
});

// Get league tournaments (events)
router.get('/:id/tournaments', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ensureLeagueScope(req, res, id)) return;
    
    const [rows] = await pool.query(
      `SELECT t.*, c.name as course_name
       FROM tournament t
       LEFT JOIN course c ON t.course_id = c.id
       WHERE t.league_id = ?
       ORDER BY t.date DESC`,
      [id]
    );
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch league tournaments' });
  }
});

// POST /api/leagues - Create new league (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const {
    billing_entity_id,
    name,
    slug,
    description,
    season_year,
    start_date,
    end_date,
    active = 1
  } = req.body;

  if (!billing_entity_id || !name || !slug) {
    return res.status(400).json({ error: 'billing_entity_id, name, and slug are required' });
  }

  try {
    // Check if billing entity exists
    const [entities] = await pool.query(
      'SELECT id FROM billing_entities WHERE id = ? LIMIT 1',
      [billing_entity_id]
    );

    if (entities.length === 0) {
      return res.status(404).json({ error: 'Billing entity not found' });
    }

    // Check if slug is unique within the billing entity
    const [existing] = await pool.query(
      'SELECT id FROM leagues WHERE billing_entity_id = ? AND slug = ? LIMIT 1',
      [billing_entity_id, slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug already exists for this billing entity' });
    }

    const [result] = await pool.query(
      `INSERT INTO leagues (billing_entity_id, name, slug, alias, cup_name, description, season_year, start_date, end_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billing_entity_id, name, slug, slug, normalizeOptionalText(cup_name) || 'Paradise Cup', description, season_year, start_date || null, end_date || null, active]
    );

    const leagueId = result.insertId;

    // Create default league settings
    await pool.query(
      `INSERT INTO league_settings (league_id) VALUES (?)`,
      [leagueId]
    );

    // Get the created league
    const [leagues] = await pool.query(
      `SELECT l.*, be.name as billing_entity_name
       FROM leagues l
       LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
       WHERE l.id = ? LIMIT 1`,
      [leagueId]
    );

    res.status(201).json({ league: leagues[0] });
  } catch (err) {
    console.error('Error creating league:', err);
    res.status(500).json({ error: 'Failed to create league' });
  }
});

// PUT /api/leagues/:id - Update league (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!ensureLeagueScope(req, res, id)) return;
  const {
    name,
    slug,
    cup_name,
    description,
    season_year,
    start_date,
    end_date,
    active
  } = req.body;

  try {
    // Check if league exists
    const [existing] = await pool.query(
      'SELECT billing_entity_id FROM leagues WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    // Check if new slug conflicts with another league in the same entity
    if (slug) {
      const [conflict] = await pool.query(
        'SELECT id FROM leagues WHERE billing_entity_id = ? AND slug = ? AND id != ? LIMIT 1',
        [existing[0].billing_entity_id, slug, id]
      );

      if (conflict.length > 0) {
        return res.status(400).json({ error: 'Slug already exists for this billing entity' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (slug !== undefined) { 
      updates.push('slug = ?'); 
      values.push(slug);
      // Also update alias to match slug
      updates.push('alias = ?'); 
      values.push(slug);
    }
    if (cup_name !== undefined) { updates.push('cup_name = ?'); values.push(normalizeOptionalText(cup_name) || 'Paradise Cup'); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (season_year !== undefined) { updates.push('season_year = ?'); values.push(season_year); }
    if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date || null); }
    if (end_date !== undefined) { updates.push('end_date = ?'); values.push(end_date || null); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await pool.query(
      `UPDATE leagues SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get the updated league
    const [leagues] = await pool.query(
      `SELECT l.*, be.name as billing_entity_name
       FROM leagues l
       LEFT JOIN billing_entities be ON l.billing_entity_id = be.id
       WHERE l.id = ? LIMIT 1`,
      [id]
    );

    res.json({ league: leagues[0] });
  } catch (err) {
    console.error('Error updating league:', err);
    res.status(500).json({ error: 'Failed to update league' });
  }
});

// DELETE /api/leagues/:id - Delete league (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!ensureLeagueScope(req, res, id)) return;

  try {
    // Check if league exists
    const [existing] = await pool.query(
      'SELECT id FROM leagues WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    // Check if league has tournaments
    const [tournaments] = await pool.query(
      'SELECT id FROM tournament WHERE league_id = ? LIMIT 1',
      [id]
    );

    if (tournaments.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete league with associated tournaments. Delete tournaments first.'
      });
    }

    await pool.query('DELETE FROM leagues WHERE id = ?', [id]);

    res.json({ message: 'League deleted successfully' });
  } catch (err) {
    console.error('Error deleting league:', err);
    res.status(500).json({ error: 'Failed to delete league' });
  }
});

module.exports = router;
