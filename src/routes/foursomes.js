const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/tournaments/:tournamentId/foursomes/:foursome - return players in a foursome
router.get('/:tournamentId/foursomes/:foursome', async (req, res) => {
  const { tournamentId, foursome } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT tp.player_id, p.name, p.email, p.phone, tp.pair
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       WHERE tp.tournament_id = ? AND tp.foursome = ?
       ORDER BY tp.pair IS NULL, tp.pair, p.name`,
      [tournamentId, foursome]
    );

    res.json(rows);
  } catch (err) {
    console.error('DB error fetching foursome', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/tournaments/:tournamentId/foursomes/:foursome/players - add a player to a foursome
// Body: { playerId, pair }
router.post('/:tournamentId/foursomes/:foursome/players', async (req, res) => {
  const { tournamentId, foursome } = req.params;
  const { playerId, pair } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId required' });

  try {
    // Ensure tournament exists
    const [tournaments] = await pool.query('SELECT id, number_of_holes FROM tournament WHERE id = ?', [tournamentId]);
    if (tournaments.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const tournament = tournaments[0];

    // Ensure player exists
    const [players] = await pool.query('SELECT id, quota_18, quota_9 FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) return res.status(404).json({ error: 'Player not found' });

    // Insert or update tournament_players row
    const holeCount = Number(tournament.number_of_holes);
    const player = players[0];
    const tq = holeCount === 9 ? player.quota_9 : player.quota_18;

    await pool.query(
      `INSERT INTO tournament_players (tournament_id, player_id, attending_status, response_date, tournament_quota, foursome, pair)
       VALUES (?, ?, 'yes', NOW(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE foursome = VALUES(foursome), pair = VALUES(pair)`,
      [tournamentId, playerId, tq, foursome, pair == null ? null : Number(pair)]
    );

    res.status(201).json({ message: 'Player added to foursome' });
  } catch (err) {
    console.error('DB error adding player to foursome', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/tournaments/:tournamentId/foursomes/:foursome/players/:playerId - remove player from tournament (or remove from foursome)
router.delete('/:tournamentId/foursomes/:foursome/players/:playerId', async (req, res) => {
  const { tournamentId, foursome, playerId } = req.params;
  try {
    // Remove the foursome/pair info for this player in this tournament
    const [result] = await pool.query(
      'UPDATE tournament_players SET foursome = NULL, pair = NULL WHERE tournament_id = ? AND player_id = ? AND foursome = ?',
      [tournamentId, playerId, foursome]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Player not found in this foursome' });
    }

    res.json({ message: 'Player removed from foursome' });
  } catch (err) {
    console.error('DB error removing player from foursome', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
