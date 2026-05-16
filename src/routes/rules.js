const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/admin');
const { getLeagueId } = require('../utils/league');

const router = express.Router();

function parseContentJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function normalizeLocalRules(localRules) {
  if (!Array.isArray(localRules)) return null;
  const normalized = localRules
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return normalized;
}

// GET /api/rules - Get current published rules for league context
router.get('/', async (req, res) => {
  try {
    const leagueId = getLeagueId(req);
    const [rows] = await pool.query(
      `SELECT id, league_id, title, status, content_json, effective_from, effective_to, published_at, updated_at
       FROM league_rulesets
       WHERE league_id = ?
         AND status = 'published'
         AND (effective_from IS NULL OR effective_from <= CURDATE())
         AND (effective_to IS NULL OR effective_to >= CURDATE())
       ORDER BY COALESCE(effective_from, '1900-01-01') DESC, published_at DESC, id DESC
       LIMIT 1`,
      [leagueId]
    );

    if (rows.length === 0) {
      return res.json({ ruleset: null, sections: [], localRules: [] });
    }

    const ruleset = rows[0];
    const parsedContent = parseContentJson(ruleset.content_json);
    
    // Support both old format (localRules array) and new format (sections array)
    const sections = Array.isArray(parsedContent.sections) ? parsedContent.sections : [];
    const localRules = Array.isArray(parsedContent.localRules) ? parsedContent.localRules : [];

    return res.json({
      ruleset: {
        id: ruleset.id,
        league_id: ruleset.league_id,
        title: ruleset.title,
        status: ruleset.status,
        effective_from: ruleset.effective_from,
        effective_to: ruleset.effective_to,
        published_at: ruleset.published_at,
        updated_at: ruleset.updated_at
      },
      sections,
      localRules
    });
  } catch (err) {
    console.error('Error fetching rules:', err);
    return res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// GET /api/rules/drafts - List draft and published rulesets (admin)
router.get('/drafts', requireAdmin, async (req, res) => {
  try {
    const leagueId = getLeagueId(req);
    const [rows] = await pool.query(
      `SELECT id, league_id, title, status, content_json, effective_from, effective_to, created_by, published_by, published_at, updated_at
       FROM league_rulesets
       WHERE league_id = ?
       ORDER BY updated_at DESC, id DESC`,
      [leagueId]
    );

    const data = rows.map((row) => ({
      ...row,
      content_json: parseContentJson(row.content_json)
    }));

    return res.json(data);
  } catch (err) {
    console.error('Error listing rules drafts:', err);
    return res.status(500).json({ error: 'Failed to list rules drafts' });
  }
});

// POST /api/rules/drafts - Create draft ruleset (admin)
router.post('/drafts', requireAdmin, async (req, res) => {
  const { title, sections, localRules, effective_from, effective_to } = req.body || {};

  // Support both old format (localRules) and new format (sections)
  let content;
  if (Array.isArray(sections) && sections.length > 0) {
    content = JSON.stringify({ sections });
  } else if (Array.isArray(localRules) && localRules.length > 0) {
    const normalized = normalizeLocalRules(localRules);
    content = JSON.stringify({ localRules: normalized });
  } else {
    return res.status(400).json({ error: 'title and either sections or localRules are required' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const leagueId = getLeagueId(req);

    const [result] = await pool.query(
      `INSERT INTO league_rulesets (league_id, title, status, content_json, effective_from, effective_to, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      [leagueId, title, content, effective_from || null, effective_to || null, req.user.id]
    );

    const [rows] = await pool.query(
      `SELECT id, league_id, title, status, content_json, effective_from, effective_to, created_by, published_by, published_at, updated_at
       FROM league_rulesets
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    const created = rows[0];
    created.content_json = parseContentJson(created.content_json);
    return res.status(201).json(created);
  } catch (err) {
    console.error('Error creating rules draft:', err);
    return res.status(500).json({ error: 'Failed to create rules draft' });
  }
});

// PUT /api/rules/:id - Update a draft ruleset (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, sections, localRules, effective_from, effective_to } = req.body || {};

  // Support both old format (localRules) and new format (sections)
  let content;
  if (Array.isArray(sections) && sections.length > 0) {
    content = JSON.stringify({ sections });
  } else if (Array.isArray(localRules) && localRules.length > 0) {
    const normalized = normalizeLocalRules(localRules);
    content = JSON.stringify({ localRules: normalized });
  } else {
    return res.status(400).json({ error: 'either sections or localRules are required' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const leagueId = getLeagueId(req);

    const [existingRows] = await pool.query(
      'SELECT id, status FROM league_rulesets WHERE id = ? AND league_id = ? LIMIT 1',
      [id, leagueId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    if (existingRows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Only draft rulesets can be edited' });
    }

    await pool.query(
      `UPDATE league_rulesets
       SET title = ?, content_json = ?, effective_from = ?, effective_to = ?
       WHERE id = ? AND league_id = ?`,
      [title, content, effective_from || null, effective_to || null, id, leagueId]
    );

    const [rows] = await pool.query(
      `SELECT id, league_id, title, status, content_json, effective_from, effective_to, created_by, published_by, published_at, updated_at
       FROM league_rulesets
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const updated = rows[0];
    updated.content_json = parseContentJson(updated.content_json);
    return res.json(updated);
  } catch (err) {
    console.error('Error updating rules draft:', err);
    return res.status(500).json({ error: 'Failed to update rules draft' });
  }
});

// POST /api/rules/:id/publish - Publish draft ruleset (admin)
router.post('/:id/publish', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    const leagueId = getLeagueId(req);

    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, status FROM league_rulesets WHERE id = ? AND league_id = ? LIMIT 1 FOR UPDATE',
      [id, leagueId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    if (rows[0].status !== 'draft') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only draft rulesets can be published' });
    }

    await conn.query(
      `UPDATE league_rulesets
       SET status = 'archived'
       WHERE league_id = ? AND status = 'published'`,
      [leagueId]
    );

    await conn.query(
      `UPDATE league_rulesets
       SET status = 'published', published_by = ?, published_at = NOW()
       WHERE id = ? AND league_id = ?`,
      [req.user.id, id, leagueId]
    );

    await conn.commit();

    const [publishedRows] = await pool.query(
      `SELECT id, league_id, title, status, content_json, effective_from, effective_to, created_by, published_by, published_at, updated_at
       FROM league_rulesets
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const published = publishedRows[0];
    published.content_json = parseContentJson(published.content_json);
    return res.json(published);
  } catch (err) {
    await conn.rollback();
    console.error('Error publishing rules draft:', err);
    return res.status(500).json({ error: 'Failed to publish rules draft' });
  } finally {
    conn.release();
  }
});

module.exports = router;
