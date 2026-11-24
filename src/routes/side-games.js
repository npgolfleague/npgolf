// Side games API: per-tournament setup and opt-in, results, and league defaults.
const express = require('express');
const pool = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/admin');
const { requireOpenSeason } = require('../middleware/season');
const { rebuildTournamentPayouts } = require('../payouts');
const {
  isGameType,
  rebuildTournamentSideGames,
  getTournamentSideGames,
  getLeagueSideGameDefaults
} = require('../sideGames');
const { GAME_TYPES } = require('../utils/sideGames');

const router = express.Router();

const toMoney = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
};

// Once a tournament is completed, changing its side games or who paid
// re-works the side-game results and prize money straight away.
// Completion is marked by its tournament_paradise_points rows (the
// tournament.completed column is not set by completion).
const refreshIfCompleted = async (tournamentId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM tournament_paradise_points WHERE tournament_id = ?',
    [tournamentId]
  );
  if (!Number(rows[0]?.n)) return false;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await rebuildTournamentSideGames(connection, tournamentId);
    await rebuildTournamentPayouts(connection, tournamentId);
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const parseId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// GET /api/tournaments/:id/side-games
router.get('/tournaments/:id/side-games', requireAuth, async (req, res) => {
  const tournamentId = parseId(req.params.id);
  if (!tournamentId) return res.status(400).json({ error: 'Invalid tournament id' });
  try {
    res.json(await getTournamentSideGames(pool, tournamentId));
  } catch (err) {
    console.error('Error loading side games:', err);
    res.status(500).json({ error: 'Failed to load side games' });
  }
});

// PUT /api/tournaments/:id/side-games
// body: { games: [{ game_type, enabled, fee, collected }] }
router.put('/tournaments/:id/side-games', requireAdmin, requireOpenSeason, async (req, res) => {
  const tournamentId = parseId(req.params.id);
  if (!tournamentId) return res.status(400).json({ error: 'Invalid tournament id' });
  const games = Array.isArray(req.body?.games) ? req.body.games : null;
  if (!games || games.some((g) => !isGameType(g?.game_type))) {
    return res.status(400).json({ error: `games must list game_type from: ${GAME_TYPES.join(', ')}` });
  }

  try {
    const [tournamentRows] = await pool.query('SELECT id FROM tournament WHERE id = ? LIMIT 1', [tournamentId]);
    if (tournamentRows.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    for (const game of games) {
      if (game.enabled) {
        const collected = game.collected === null || game.collected === undefined || game.collected === ''
          ? null
          : toMoney(game.collected, null);
        await pool.query(
          `INSERT INTO tournament_side_games (tournament_id, game_type, fee, collected)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE fee = VALUES(fee), collected = VALUES(collected)`,
          [tournamentId, game.game_type, toMoney(game.fee), collected]
        );
      } else {
        await pool.query('DELETE FROM tournament_side_games WHERE tournament_id = ? AND game_type = ?', [tournamentId, game.game_type]);
        await pool.query('DELETE FROM tournament_side_game_entries WHERE tournament_id = ? AND game_type = ?', [tournamentId, game.game_type]);
      }
    }

    await refreshIfCompleted(tournamentId);
    res.json(await getTournamentSideGames(pool, tournamentId));
  } catch (err) {
    console.error('Error saving side games:', err);
    res.status(500).json({ error: 'Failed to save side games' });
  }
});

// PUT /api/tournaments/:id/side-games/:type/players/:playerId/paid  body: { paid }
router.put('/tournaments/:id/side-games/:type/players/:playerId/paid', requireAdmin, requireOpenSeason, async (req, res) => {
  const tournamentId = parseId(req.params.id);
  const playerId = parseId(req.params.playerId);
  const gameType = req.params.type;
  if (!tournamentId || !playerId || !isGameType(gameType)) {
    return res.status(400).json({ error: 'Invalid tournament, player or game' });
  }
  if (req.body?.paid === undefined) return res.status(400).json({ error: 'paid is required' });

  try {
    const [gameRows] = await pool.query(
      'SELECT id FROM tournament_side_games WHERE tournament_id = ? AND game_type = ? LIMIT 1',
      [tournamentId, gameType]
    );
    if (gameRows.length === 0) return res.status(404).json({ error: 'That side game is not on for this tournament' });

    const [playerRows] = await pool.query(
      'SELECT id FROM tournament_players WHERE tournament_id = ? AND player_id = ? LIMIT 1',
      [tournamentId, playerId]
    );
    if (playerRows.length === 0) return res.status(404).json({ error: 'Player not found in this tournament' });

    await pool.query(
      `INSERT INTO tournament_side_game_entries (tournament_id, game_type, player_id, paid)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE paid = VALUES(paid)`,
      [tournamentId, gameType, playerId, req.body.paid ? 1 : 0]
    );

    await refreshIfCompleted(tournamentId);
    res.json({ message: 'Side game paid status updated' });
  } catch (err) {
    console.error('Error updating side game entry:', err);
    res.status(500).json({ error: 'Failed to update side game entry' });
  }
});

// GET /api/leagues/:id/side-game-defaults
router.get('/leagues/:id/side-game-defaults', requireAuth, async (req, res) => {
  const leagueId = parseId(req.params.id);
  if (!leagueId) return res.status(400).json({ error: 'Invalid league id' });
  try {
    res.json(await getLeagueSideGameDefaults(pool, leagueId));
  } catch (err) {
    console.error('Error loading side game defaults:', err);
    res.status(500).json({ error: 'Failed to load side game defaults' });
  }
});

// PUT /api/leagues/:id/side-game-defaults
// body: { defaults: [{ game_type, enabled, fee_9, fee_18 }] }
router.put('/leagues/:id/side-game-defaults', requireAdmin, async (req, res) => {
  const leagueId = parseId(req.params.id);
  if (!leagueId) return res.status(400).json({ error: 'Invalid league id' });
  const defaults = Array.isArray(req.body?.defaults) ? req.body.defaults : null;
  if (!defaults || defaults.some((d) => !isGameType(d?.game_type))) {
    return res.status(400).json({ error: `defaults must list game_type from: ${GAME_TYPES.join(', ')}` });
  }

  try {
    for (const d of defaults) {
      await pool.query(
        `INSERT INTO league_side_game_defaults (league_id, game_type, enabled, fee_9, fee_18)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), fee_9 = VALUES(fee_9), fee_18 = VALUES(fee_18)`,
        [leagueId, d.game_type, d.enabled ? 1 : 0, toMoney(d.fee_9, 2), toMoney(d.fee_18, 5)]
      );
    }
    res.json(await getLeagueSideGameDefaults(pool, leagueId));
  } catch (err) {
    console.error('Error saving side game defaults:', err);
    res.status(500).json({ error: 'Failed to save side game defaults' });
  }
});

module.exports = router;
