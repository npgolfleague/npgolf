// Closed seasons are read-only (see src/seasons.js). These block changes to
// tournaments, rosters and scores once the season has been closed.
const pool = require('../db');
const { SeasonError, assertSeasonOpen } = require('../seasons');
const { assertTournamentAccess, AuthError } = require('./admin');

const fail = (res, err) => {
  if (err instanceof SeasonError || err instanceof AuthError) return res.status(err.status).json({ error: err.message });
  console.error('Error checking tournament season:', err);
  return res.status(500).json({ error: 'Failed to check tournament season' });
};

const assertTournamentOpen = async (db, tournamentId) => {
  const [rows] = await db.query('SELECT season_id FROM tournament WHERE id = ? LIMIT 1', [tournamentId]);
  if (rows.length > 0) await assertSeasonOpen(db, rows[0].season_id);
};

// getIds(req) returns the tournament id(s) the request would change.
// checkAccess: the ids aren't in the URL, so the auth middleware hasn't checked them.
const requireOpen = (getIds, { checkAccess = false } = {}) => async (req, res, next) => {
  try {
    const ids = [...new Set((await getIds(req)).filter((id) => id != null).map(String))];
    for (const id of ids) {
      if (checkAccess) await assertTournamentAccess(req, req.user, id);
      await assertTournamentOpen(pool, id);
    }
  } catch (err) {
    return fail(res, err);
  }
  return next();
};

// Tournament id in the URL, as :id or :tournamentId.
const requireOpenSeason = requireOpen(async (req) => [req.params.tournamentId ?? req.params.id]);

// POST /api/scores: body.scores may name any tournament.
const requireOpenSeasonForScores = requireOpen(async (req) => (
  Array.isArray(req.body?.scores) ? req.body.scores.map((s) => s?.tournament_id ?? 'missing') : []
), { checkAccess: true });

// /api/scores/:id: look up the score's tournament.
const requireOpenSeasonForScore = requireOpen(async (req) => {
  const [rows] = await pool.query('SELECT tournament_id FROM scores WHERE id = ? LIMIT 1', [req.params.id]);
  return rows.map((r) => r.tournament_id);
}, { checkAccess: true });

module.exports = { requireOpenSeason, requireOpenSeasonForScores, requireOpenSeasonForScore };
