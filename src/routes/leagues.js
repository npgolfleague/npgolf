const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/admin');
const router = express.Router();

// Get league by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    const [rows] = await pool.query(
      'SELECT * FROM league_settings WHERE league_id = ? LIMIT 1',
      [id]
    );
    
    if (rows.length === 0) {
      // Return defaults — settings row will be created on first save
      return res.json({
        league_id: Number(id),
        tournament_fee_18_holes: 20.00,
        tournament_fee_9_holes: 10.00,
        skins_ctp_fee_18_holes: 10.00,
        skins_ctp_fee_9_holes: 5.00,
        golf_course_email: null,
        quota_points_albatross: 8,
        quota_points_eagle: 8,
        quota_points_birdie: 6,
        quota_points_par: 4,
        quota_points_bogey: 2,
        quota_points_double_bogey: 1,
        quota_points_worse: 0,
        live_scoring: 1
      });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Failed to fetch league settings' });
  }
});

// PUT /api/leagues/:id/settings - Update league settings (admin only)
router.put('/:id/settings', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    tournament_fee_18_holes, tournament_fee_9_holes,
    skins_ctp_fee_18_holes, skins_ctp_fee_9_holes,
    golf_course_email,
    quota_points_albatross, quota_points_eagle, quota_points_birdie,
    quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse,
    live_scoring
  } = req.body;

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
        quota_points_albatross, quota_points_eagle, quota_points_birdie,
        quota_points_par, quota_points_bogey, quota_points_double_bogey, quota_points_worse,
        live_scoring
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tournament_fee_18_holes = VALUES(tournament_fee_18_holes),
        tournament_fee_9_holes = VALUES(tournament_fee_9_holes),
        skins_ctp_fee_18_holes = VALUES(skins_ctp_fee_18_holes),
        skins_ctp_fee_9_holes = VALUES(skins_ctp_fee_9_holes),
        golf_course_email = VALUES(golf_course_email),
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
        golf_course_email ?? null,
        quota_points_albatross ?? 8, quota_points_eagle ?? 8, quota_points_birdie ?? 6,
        quota_points_par ?? 4, quota_points_bogey ?? 2, quota_points_double_bogey ?? 1,
        quota_points_worse ?? 0,
        live_scoring != null ? (live_scoring ? 1 : 0) : 1
      ]
    );

    const [rows] = await pool.query('SELECT * FROM league_settings WHERE league_id = ? LIMIT 1', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating league settings:', err);
    res.status(500).json({ error: 'Failed to update league settings' });
  }
});

// Get league players
router.get('/:id/players', async (req, res) => {
  try {
    const { id } = req.params;
    
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
      `INSERT INTO leagues (billing_entity_id, name, slug, alias, description, season_year, start_date, end_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billing_entity_id, name, slug, slug, description, season_year, start_date || null, end_date || null, active]
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
  const {
    name,
    slug,
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
