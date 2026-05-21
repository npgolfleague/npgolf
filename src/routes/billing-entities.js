const express = require('express');
const pool = require('../db');
const { requireSuperAdmin } = require('../middleware/admin');

const router = express.Router();

// All routes require super admin access
router.use(requireSuperAdmin);

// GET /api/billing-entities - List all billing entities
router.get('/', async (req, res) => {
  try {
    const [entities] = await pool.query(`
      SELECT 
        be.*,
        COUNT(DISTINCT ber.player_id) as member_count,
        COUNT(DISTINCT l.id) as league_count
      FROM billing_entities be
      LEFT JOIN billing_entity_roles ber ON be.id = ber.billing_entity_id
      LEFT JOIN leagues l ON be.id = l.billing_entity_id
      GROUP BY be.id
      ORDER BY be.created_at DESC
    `);
    
    res.json({ entities });
  } catch (err) {
    console.error('Error fetching billing entities:', err);
    res.status(500).json({ error: 'Failed to fetch billing entities' });
  }
});

// GET /api/billing-entities/:id - Get single billing entity with details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [entities] = await pool.query(`
      SELECT be.* FROM billing_entities be WHERE be.id = ? LIMIT 1
    `, [id]);
    
    if (entities.length === 0) {
      return res.status(404).json({ error: 'Billing entity not found' });
    }
    
    const entity = entities[0];
    
    // Get members
    const [members] = await pool.query(`
      SELECT 
        p.id, p.name, p.email, ber.role, ber.joined_at
      FROM billing_entity_roles ber
      JOIN players p ON ber.player_id = p.id
      WHERE ber.billing_entity_id = ?
      ORDER BY ber.role, p.name
    `, [id]);
    
    // Get leagues
    const [leagues] = await pool.query(`
      SELECT id, name, slug, alias, description, season_year, start_date, end_date, active
      FROM leagues
      WHERE billing_entity_id = ?
      ORDER BY name
    `, [id]);
    
    res.json({ entity, members, leagues });
  } catch (err) {
    console.error('Error fetching billing entity:', err);
    res.status(500).json({ error: 'Failed to fetch billing entity' });
  }
});

// POST /api/billing-entities - Create new billing entity
router.post('/', async (req, res) => {
  const {
    name,
    slug,
    entity_type = 'league_organization',
    description,
    logo_url,
    website,
    timezone = 'America/Los_Angeles',
    billing_email,
    billing_name,
    billing_address,
    active = 1
  } = req.body;
  
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }
  
  try {
    // Check if slug already exists
    const [existing] = await pool.query(
      'SELECT id FROM billing_entities WHERE slug = ? LIMIT 1',
      [slug]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug already exists' });
    }
    
    const [result] = await pool.query(`
      INSERT INTO billing_entities (
        name, slug, entity_type, description, logo_url, website,
        timezone, billing_email, billing_name, billing_address, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, slug, entity_type, description, logo_url, website,
      timezone, billing_email, billing_name, billing_address, active
    ]);
    
    const entityId = result.insertId;
    
    // Get the created entity
    const [entities] = await pool.query(
      'SELECT * FROM billing_entities WHERE id = ? LIMIT 1',
      [entityId]
    );
    
    res.status(201).json({ entity: entities[0] });
  } catch (err) {
    console.error('Error creating billing entity:', err);
    res.status(500).json({ error: 'Failed to create billing entity' });
  }
});

// PUT /api/billing-entities/:id - Update billing entity
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    slug,
    entity_type,
    description,
    logo_url,
    website,
    timezone,
    billing_email,
    billing_name,
    billing_address,
    stripe_customer_id,
    active
  } = req.body;
  
  try {
    // Check if entity exists
    const [existing] = await pool.query(
      'SELECT id FROM billing_entities WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Billing entity not found' });
    }
    
    // Check if new slug conflicts with another entity
    if (slug) {
      const [conflict] = await pool.query(
        'SELECT id FROM billing_entities WHERE slug = ? AND id != ? LIMIT 1',
        [slug, id]
      );
      
      if (conflict.length > 0) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (slug !== undefined) { updates.push('slug = ?'); values.push(slug); }
    if (entity_type !== undefined) { updates.push('entity_type = ?'); values.push(entity_type); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website); }
    if (timezone !== undefined) { updates.push('timezone = ?'); values.push(timezone); }
    if (billing_email !== undefined) { updates.push('billing_email = ?'); values.push(billing_email); }
    if (billing_name !== undefined) { updates.push('billing_name = ?'); values.push(billing_name); }
    if (billing_address !== undefined) { updates.push('billing_address = ?'); values.push(billing_address); }
    if (stripe_customer_id !== undefined) { updates.push('stripe_customer_id = ?'); values.push(stripe_customer_id); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE billing_entities SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Get the updated entity
    const [entities] = await pool.query(
      'SELECT * FROM billing_entities WHERE id = ? LIMIT 1',
      [id]
    );
    
    res.json({ entity: entities[0] });
  } catch (err) {
    console.error('Error updating billing entity:', err);
    res.status(500).json({ error: 'Failed to update billing entity' });
  }
});

// DELETE /api/billing-entities/:id - Delete billing entity
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if entity exists
    const [existing] = await pool.query(
      'SELECT id FROM billing_entities WHERE id = ? LIMIT 1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Billing entity not found' });
    }
    
    // Check if entity has leagues
    const [leagues] = await pool.query(
      'SELECT id FROM leagues WHERE billing_entity_id = ? LIMIT 1',
      [id]
    );
    
    if (leagues.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete billing entity with associated leagues. Remove or reassign leagues first.' 
      });
    }
    
    // Check if entity has players
    const [players] = await pool.query(
      'SELECT id FROM players WHERE billing_entity_id = ? LIMIT 1',
      [id]
    );
    
    if (players.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete billing entity with associated players. Remove or reassign players first.' 
      });
    }
    
    await pool.query('DELETE FROM billing_entities WHERE id = ?', [id]);
    
    res.json({ message: 'Billing entity deleted successfully' });
  } catch (err) {
    console.error('Error deleting billing entity:', err);
    res.status(500).json({ error: 'Failed to delete billing entity' });
  }
});

module.exports = router;
