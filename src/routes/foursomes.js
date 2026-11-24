const express = require('express');
const pool = require('../db');
const { requireAdmin, requireAuth, assertLeagueAdmin, AuthError } = require('../middleware/admin');
const { requireOpenSeason } = require('../middleware/season');
const router = express.Router();

// GET /api/tournaments/:tournamentId/foursomes/:foursome - return players in a foursome
router.get('/:tournamentId/foursomes/:foursome', requireAuth, async (req, res) => {
  const { tournamentId, foursome } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT tp.player_id, p.name, tp.pair
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
router.post('/:tournamentId/foursomes/:foursome/players', requireAdmin, requireOpenSeason, async (req, res) => {
  const { tournamentId, foursome } = req.params;
  const { playerId, pair } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId required' });

  try {
    // Ensure tournament exists
    const [tournaments] = await pool.query('SELECT id, number_of_holes, league_id FROM tournament WHERE id = ?', [tournamentId]);
    if (tournaments.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    const tournament = tournaments[0];

    // Ensure player exists
    const [found] = await pool.query('SELECT id FROM players WHERE id = ?', [playerId]);
    if (found.length === 0) return res.status(404).json({ error: 'Player not found' });

    // Playing in this tournament makes the player a member of its league;
    // quota comes from that league's membership row.
    await pool.query(
      'INSERT IGNORE INTO league_players (league_id, player_id) VALUES (?, ?)',
      [tournament.league_id, playerId]
    );
    const [players] = await pool.query(
      'SELECT player_id AS id, quota_18, quota_9 FROM league_players WHERE league_id = ? AND player_id = ?',
      [tournament.league_id, playerId]
    );

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
router.delete('/:tournamentId/foursomes/:foursome/players/:playerId', requireAdmin, requireOpenSeason, async (req, res) => {
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

// PUT /api/tournaments/:tournamentId/foursomes/:foursome/roster
// Body: { playerIds: [int], pairs?: { playerId: pairNumber|null } }
// Replaces the foursome's line-up: listed players are put in this foursome
// (moving them out of any other), and players no longer listed are taken out
// of it. Any signed-in player can change their foursome while scores are
// being entered; once the foursome is posted or the tournament is completed,
// only a league admin can.
router.put('/:tournamentId/foursomes/:foursome/roster', requireAuth, requireOpenSeason, async (req, res) => {
  const { tournamentId, foursome } = req.params;
  const playerIds = Array.isArray(req.body?.playerIds)
    ? [...new Set(req.body.playerIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : null;
  const pairsInput = req.body?.pairs && typeof req.body.pairs === 'object' ? req.body.pairs : {};

  if (!foursome || !String(foursome).trim()) return res.status(400).json({ error: 'foursome is required' });
  if (!playerIds) return res.status(400).json({ error: 'playerIds must be an array' });
  if (playerIds.length > 5) return res.status(400).json({ error: 'A foursome can have at most 5 players' });

  try {
    const [tournaments] = await pool.query(
      `SELECT t.id, t.number_of_holes, t.league_id,
              EXISTS (SELECT 1 FROM tournament_paradise_points x WHERE x.tournament_id = t.id) AS is_completed
       FROM tournament t WHERE t.id = ?`,
      [tournamentId]
    );
    const tournament = tournaments[0];
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const [posted] = await pool.query(
      'SELECT id FROM foursome_posts WHERE tournament_id = ? AND foursome_group = ? LIMIT 1',
      [tournamentId, foursome]
    );
    if (Number(tournament.is_completed) === 1 || posted.length > 0) {
      try {
        await assertLeagueAdmin(req, req.user);
      } catch (authErr) {
        if (authErr instanceof AuthError) {
          return res.status(403).json({ error: 'This foursome is locked. Ask an admin to change it.' });
        }
        throw authErr;
      }
    }

    if (playerIds.length > 0) {
      const [found] = await pool.query(
        `SELECT id FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
        playerIds
      );
      if (found.length !== playerIds.length) return res.status(400).json({ error: 'Unknown player in playerIds' });
    }

    // Players can rearrange foursomes (no-shows, late arrivals), but only with
    // league members and without taking anyone from a card that's been posted.
    let admin = true;
    try {
      await assertLeagueAdmin(req, req.user);
    } catch (authErr) {
      if (!(authErr instanceof AuthError)) throw authErr;
      admin = false;
    }
    if (!admin && playerIds.length > 0) {
      const marks = playerIds.map(() => '?').join(',');
      const [members] = await pool.query(
        `SELECT player_id FROM league_players WHERE league_id = ? AND player_id IN (${marks})`,
        [tournament.league_id, ...playerIds]
      );
      if (members.length !== playerIds.length) {
        return res.status(403).json({ error: 'Only players in this league can be added to a foursome.' });
      }
      const [locked] = await pool.query(
        `SELECT p.name FROM tournament_players tp
         JOIN foursome_posts fp ON fp.tournament_id = tp.tournament_id AND fp.foursome_group = tp.foursome
         JOIN players p ON p.id = tp.player_id
         WHERE tp.tournament_id = ? AND tp.foursome <> ? AND tp.player_id IN (${marks}) LIMIT 1`,
        [tournamentId, foursome, ...playerIds]
      );
      if (locked.length > 0) {
        return res.status(403).json({ error: `${locked[0].name}'s foursome has posted its card. Ask an admin to move them.` });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Players no longer in the line-up leave this foursome.
      await conn.query(
        `UPDATE tournament_players SET foursome = NULL, pair = NULL
         WHERE tournament_id = ? AND foursome = ?${playerIds.length ? ` AND player_id NOT IN (${playerIds.map(() => '?').join(',')})` : ''}`,
        [tournamentId, foursome, ...playerIds]
      );

      for (const pid of playerIds) {
        // Playing in this tournament makes the player a member of its league.
        await conn.query('INSERT IGNORE INTO league_players (league_id, player_id) VALUES (?, ?)', [tournament.league_id, pid]);
        const rawPair = pairsInput[pid];
        const pair = rawPair === undefined || rawPair === null || rawPair === '' ? null : Number(rawPair);
        await conn.query(
          `INSERT INTO tournament_players (tournament_id, player_id, attending_status, response_date, tournament_quota, foursome, pair)
           SELECT ?, ?, 'yes', NOW(),
                  CASE WHEN ? = 9 THEN lp.quota_9 ELSE lp.quota_18 END,
                  ?, ?
           FROM (SELECT 1) one
           LEFT JOIN league_players lp ON lp.league_id = ? AND lp.player_id = ?
           ON DUPLICATE KEY UPDATE foursome = VALUES(foursome), pair = VALUES(pair),
             attending_status = IF(tournament_players.attending_status = 'no', 'yes', tournament_players.attending_status)`,
          [tournamentId, pid, Number(tournament.number_of_holes), foursome, Number.isFinite(pair) ? pair : null, tournament.league_id, pid]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query(
      `SELECT tp.player_id, p.name, tp.pair
       FROM tournament_players tp JOIN players p ON p.id = tp.player_id
       WHERE tp.tournament_id = ? AND tp.foursome = ?
       ORDER BY tp.pair IS NULL, tp.pair, p.name`,
      [tournamentId, foursome]
    );
    res.json(rows);
  } catch (err) {
    console.error('DB error saving foursome roster', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
