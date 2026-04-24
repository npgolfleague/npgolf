const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/tournaments/:tournamentId/players - Get all players in a tournament
router.get('/:tournamentId/players', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.email, p.phone, p.sex, p.quota_18, p.quota_9, p.role,
             tp.registration_date, tp.paid, tp.skins_ctp_paid, tp.attending_status, tp.response_date,
             tp.foursome AS foursome, tp.pair AS pair
      FROM players p
      JOIN tournament_players tp ON p.id = tp.player_id
      WHERE tp.tournament_id = ?
      ORDER BY p.name ASC
    `, [tournamentId]);
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/tournaments/:tournamentId/players - Add a player to a tournament
// Body: { playerId }
router.post('/:tournamentId/players', async (req, res) => {
  const { tournamentId } = req.params;
  const { playerId } = req.body;
  
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  
  try {
    // Check if tournament exists
    const [tournaments] = await pool.query('SELECT id, number_of_holes FROM tournament WHERE id = ?', [tournamentId]);
    if (tournaments.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Check if player exists
    const [players] = await pool.query('SELECT id, quota_18, quota_9 FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Snapshot the player's current quota based on tournament hole count
    const tournament = tournaments[0];
    const player = players[0];
    const holeCount = Number(tournament.number_of_holes);
    const tournamentQuota = holeCount === 9 ? player.quota_9 : player.quota_18;

    // Add player to tournament as actively playing (yes)
    // so admin-added players appear in confirmed lists immediately
    await pool.query(
      `INSERT INTO tournament_players (tournament_id, player_id, attending_status, response_date, tournament_quota)
       VALUES (?, ?, 'yes', NOW(), ?)`,
      [tournamentId, playerId, tournamentQuota]
    );
    
    res.status(201).json({ message: 'Player added to tournament successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Player already registered for this tournament' });
    }
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/tournaments/:tournamentId/players/:playerId - Remove a player from a tournament
router.delete('/:tournamentId/players/:playerId', async (req, res) => {
  const { tournamentId, playerId } = req.params;
  
  try {
    const [result] = await pool.query(
      'DELETE FROM tournament_players WHERE tournament_id = ? AND player_id = ?',
      [tournamentId, playerId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found in this tournament' });
    }
    
    res.json({ message: 'Player removed from tournament successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/tournaments/:tournamentId/foursome-group - Assign a foursome identifier to one or more tournament players
// Body: { group: string, playerIds: [int], pairs?: { playerId: pairNumber } }
router.post('/:tournamentId/foursome-group', async (req, res) => {
  const { tournamentId } = req.params;
  const { group, playerIds } = req.body;

  if (!group) {
    return res.status(400).json({ error: 'group is required' });
  }

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'playerIds must be a non-empty array' });
  }

  try {
    // Ensure tournament exists and get hole count
    const [tournaments] = await pool.query('SELECT id, number_of_holes FROM tournament WHERE id = ?', [tournamentId])
    if (tournaments.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' })
    }
    const tournament = tournaments[0]

    // Determine which player rows already exist in tournament_players
    const placeholders = playerIds.map(() => '?').join(',')
    const params = [tournamentId, ...playerIds]
    const [existing] = await pool.query(
      `SELECT player_id FROM tournament_players WHERE tournament_id = ? AND player_id IN (${placeholders})`,
      params
    )

    const existingIds = existing.map(r => r.player_id)
    const missingIds = playerIds.filter(id => !existingIds.includes(id))

    // Start transaction to insert any missing tournament_players rows then update group
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      if (missingIds.length > 0) {
        // Fetch player quotas to seed tournament_quota
        const [players] = await conn.query(
          `SELECT id, quota_18, quota_9 FROM players WHERE id IN (${missingIds.map(() => '?').join(',')})`,
          missingIds
        )

        const holeCount = Number(tournament.number_of_holes)
        const insertValues = []
        const insertParams = []

        // Build multi-row insert values
        for (const p of players) {
          const tq = holeCount === 9 ? p.quota_9 : p.quota_18
          insertValues.push('(?, ?, ?, NOW(), ?)')
          insertParams.push(tournamentId, p.id, 'yes', tq)
        }

        if (insertValues.length > 0) {
          const insertQuery = `INSERT INTO tournament_players (tournament_id, player_id, attending_status, response_date, tournament_quota) VALUES ${insertValues.join(',')} ON DUPLICATE KEY UPDATE player_id = player_id`
          await conn.query(insertQuery, insertParams)
        }
      }

      // Optionally update pair assignments if provided (body: pairs: { playerId: pairNumber, ... } or [{playerId, pair}])
      const pairsInput = req.body.pairs
      if (pairsInput) {
        const pairsMap = {}
        if (Array.isArray(pairsInput)) {
          pairsInput.forEach(it => { if (it && it.playerId) pairsMap[it.playerId] = Number(it.pair) || null })
        } else if (typeof pairsInput === 'object') {
          Object.keys(pairsInput).forEach(k => { pairsMap[Number(k)] = pairsInput[k] == null ? null : Number(pairsInput[k]) })
        }

        const toUpdate = Object.keys(pairsMap).map(id => Number(id)).filter(id => !Number.isNaN(id))
        for (const pid of toUpdate) {
          await conn.query('UPDATE tournament_players SET pair = ? WHERE tournament_id = ? AND player_id = ?', [pairsMap[pid], tournamentId, pid])
        }
      }

      // Now update the foursome identifier for all provided players
      const allIds = playerIds
      const updateParams = [group, tournamentId, ...allIds]
      const [result] = await conn.query(
        `UPDATE tournament_players SET foursome = ? WHERE tournament_id = ? AND player_id IN (${allIds.map(() => '?').join(',')})`,
        updateParams
      )

      await conn.commit()
      res.json({ message: 'Foursome assigned', affectedRows: result.affectedRows })
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('DB error assigning foursome', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// PUT /api/tournaments/:tournamentId/players/:playerId/paid - Update paid status
router.put('/:tournamentId/players/:playerId/paid', async (req, res) => {
  const { tournamentId, playerId } = req.params;
  const { paid } = req.body;
  
  if (paid === undefined) {
    return res.status(400).json({ error: 'paid status is required' });
  }
  
  try {
    const [result] = await pool.query(
      'UPDATE tournament_players SET paid = ? WHERE tournament_id = ? AND player_id = ?',
      [paid ? 1 : 0, tournamentId, playerId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found in this tournament' });
    }
    
    res.json({ message: 'Paid status updated successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/tournaments/:tournamentId/players/:playerId/skins-ctp-paid - Update skins/CTP paid status
router.put('/:tournamentId/players/:playerId/skins-ctp-paid', async (req, res) => {
  const { tournamentId, playerId } = req.params;
  const { skins_ctp_paid } = req.body;
  
  if (skins_ctp_paid === undefined) {
    return res.status(400).json({ error: 'skins_ctp_paid status is required' });
  }
  
  try {
    const [result] = await pool.query(
      'UPDATE tournament_players SET skins_ctp_paid = ? WHERE tournament_id = ? AND player_id = ?',
      [skins_ctp_paid ? 1 : 0, tournamentId, playerId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found in this tournament' });
    }
    
    res.json({ message: 'Skins/CTP paid status updated successfully' });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/tournaments/:tournamentId/available-players - Get players NOT in the tournament
router.get('/:tournamentId/available-players', async (req, res) => {
  const { tournamentId } = req.params;
  
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.email, p.phone, p.sex, p.quota_18, p.quota_9, p.role
      FROM players p
      WHERE p.active = 1
        AND p.id NOT IN (
          SELECT player_id 
          FROM tournament_players 
          WHERE tournament_id = ?
        )
      ORDER BY p.name ASC
    `, [tournamentId]);
    
    res.json(rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
