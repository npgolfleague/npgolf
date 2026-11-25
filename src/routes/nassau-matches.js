// Individual Nassau match play: propose, accept, decline, remove, and results.
const express = require('express');
const pool = require('../db');
const { requireAuth, assertLeagueAdmin, AuthError } = require('../middleware/admin');
const { requireOpenSeason } = require('../middleware/season');
const { allocateStrokes, scoreNassauMatch } = require('../utils/matchPlay');

const router = express.Router();

const MAX_AMOUNT = 10000;
const parseId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const flag = (value) => (value === true ? 1 : 0);

// The proposal's terms, or { error }.
const parseTerms = (body) => {
  const terms = {};
  for (const [name, label] of [['amount_front', 'front 9'], ['amount_back', 'back 9'], ['amount_overall', 'overall']]) {
    const raw = body[name];
    const n = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return { error: `Enter the ${label} amount, from $0 to $${MAX_AMOUNT}` };
    terms[name] = Math.round(n * 100) / 100;
  }
  terms.use_handicaps = flag(body.use_handicaps);
  for (const name of ['handicap_a', 'handicap_b']) {
    if (!terms.use_handicaps) { terms[name] = null; continue; }
    const raw = body[name];
    const n = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isInteger(n) || n < -10 || n > 54) return { error: 'Enter both handicaps as whole numbers from -10 to 54' };
    terms[name] = n;
  }
  terms.auto_press = flag(body.auto_press);
  terms.carry_halved = flag(body.carry_halved);
  return { terms };
};

// A round can have matches only when it's 18 holes.
const loadRound = async (tournamentId) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.course_id, t.number_of_holes,
            EXISTS (SELECT 1 FROM tournament_paradise_points x WHERE x.tournament_id = t.id) AS completed
     FROM tournament t WHERE t.id = ?`,
    [tournamentId]
  );
  return rows[0] || null;
};

// Terms can't be agreed or dropped once either player has a score.
const hasStarted = async (tournamentId, ids) => {
  const [rows] = await pool.query('SELECT 1 FROM scores WHERE tournament_id = ? AND player_id IN (?, ?) LIMIT 1', [tournamentId, ...ids]);
  return rows.length > 0;
};

const isAdmin = async (req) => {
  try {
    await assertLeagueAdmin(req, req.user);
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
};

// Stroke indexes on one player's card: their tee for the round, else the first
// tee for their gender, else the first tee (the same rule as par).
const loadCard = async (round, playerId) => {
  const [rows] = await pool.query(
    `SELECT h.hole_number AS hole, ht.handicap AS stroke_index
     FROM hole h
     JOIN hole_tee ht ON ht.hole_id = h.id
     JOIN course_tee ct ON ct.id = ht.tee_id
     JOIN players p ON p.id = ?
     LEFT JOIN tournament_players tp ON tp.tournament_id = ? AND tp.player_id = p.id
     WHERE h.course_id = ?
     ORDER BY h.hole_number, (ht.tee_id <=> tp.tee_id) DESC,
              (ct.gender <=> IF(p.sex = 'F', 'F', 'M')) DESC, ct.id ASC`,
    [playerId, round.id, round.course_id]
  );
  const card = new Map();
  for (const row of rows) {
    const hole = Number(row.hole);
    if (!card.has(hole)) card.set(hole, { hole, index: Number(row.stroke_index) || null });
  }
  return [...card.values()];
};

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

// What one person may see of a match. Holes appear only once both players have
// finished them. Scores and dollar amounts are for the two players alone, and so
// are matches that haven't been accepted.
const presentMatch = async (round, m, viewerId, scoresOf) => {
  const ids = [Number(m.player_a), Number(m.player_b)];
  const mine = ids.includes(Number(viewerId));
  const started = ids.some((id) => scoresOf.get(id)?.size > 0);
  const useHandicaps = Number(m.use_handicaps) === 1;
  const difference = useHandicaps ? Number(m.handicap_a) - Number(m.handicap_b) : 0;
  const receiver = difference === 0 ? null : difference > 0 ? 0 : 1;
  const base = {
    id: Number(m.id),
    player_a: ids[0],
    player_b: ids[1],
    names: [m.name_a, m.name_b],
    status: m.status === 'pending' && (started || Number(round.completed) === 1) ? 'expired' : m.status,
    mine,
    started,
    auto_press: Number(m.auto_press) === 1,
    carry_halved: Number(m.carry_halved) === 1,
    use_handicaps: useHandicaps,
    strokes: { receiver, count: Math.abs(difference) }
  };
  const amounts = { front: Number(m.amount_front), back: Number(m.amount_back), overall: Number(m.amount_overall) };
  if (mine) Object.assign(base, { amounts, handicaps: useHandicaps ? [Number(m.handicap_a), Number(m.handicap_b)] : null });
  if (m.status !== 'accepted') return base;

  const strokes = [new Map(), new Map()];
  if (receiver !== null) strokes[receiver] = allocateStrokes(Math.abs(difference), await loadCard(round, ids[receiver]));
  const result = scoreNassauMatch(HOLES, ids.map((id) => scoresOf.get(id) || new Map()), strokes, {
    amounts, autoPress: base.auto_press, carryHalved: base.carry_halved
  });
  base.decided = result.decided;
  base.holes = result.holes.map(({ scores, ...hole }) => (mine ? { ...hole, scores: scores || null } : hole));
  base.bets = result.bets.map(({ amount, ...bet }) => (mine ? { ...bet, amount } : bet));
  if (mine) base.net = result.net;
  return base;
};

const listMatches = async (round, viewerId) => {
  if (Number(round.number_of_holes) !== 18) return [];
  const [matches] = await pool.query(
    `SELECT m.*, pa.name AS name_a, pb.name AS name_b
     FROM nassau_matches m
     JOIN players pa ON pa.id = m.player_a
     JOIN players pb ON pb.id = m.player_b
     WHERE m.tournament_id = ?
       AND (m.status = 'accepted' OR m.player_a = ? OR m.player_b = ?)
     ORDER BY m.id`,
    [round.id, viewerId, viewerId]
  );
  if (matches.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT s.player_id, h.hole_number, s.score
     FROM scores s JOIN hole h ON h.id = s.hole_id
     WHERE s.tournament_id = ?`,
    [round.id]
  );
  const scoresOf = new Map();
  for (const row of rows) {
    const id = Number(row.player_id);
    if (!scoresOf.has(id)) scoresOf.set(id, new Map());
    scoresOf.get(id).set(Number(row.hole_number), Number(row.score));
  }
  const out = [];
  for (const m of matches) out.push(await presentMatch(round, m, viewerId, scoresOf));
  return out;
};

// Runs a route with the round loaded; `send` answers with the fresh list.
const withRound = (handler) => async (req, res) => {
  const tournamentId = parseId(req.params.id);
  if (!tournamentId) return res.status(400).json({ error: 'Invalid tournament id' });
  try {
    const round = await loadRound(tournamentId);
    if (!round) return res.status(404).json({ error: 'Tournament not found' });
    return await handler(req, res, round, async (status = 200) => {
      res.status(status).json({ matches: await listMatches(round, req.user.id), can_admin: await isAdmin(req) });
    });
  } catch (err) {
    console.error('Nassau match error:', err);
    return res.status(500).json({ error: 'Something went wrong with the match. Please try again.' });
  }
};

const loadMatch = async (round, matchId) => {
  const [rows] = await pool.query('SELECT * FROM nassau_matches WHERE id = ? AND tournament_id = ?', [parseId(matchId) || 0, round.id]);
  return rows[0] || null;
};
const GONE = { error: 'That match no longer exists' };
const STARTED = { error: 'One of you already has a score, so the match can no longer be changed' };

// GET /api/tournaments/:id/nassau-matches
router.get('/tournaments/:id/nassau-matches', requireAuth, withRound((_req, _res, _round, send) => send()));

// POST /api/tournaments/:id/nassau-matches  body: { opponent_id, ...terms }
// handicap_a is the proposer's, handicap_b the opponent's.
router.post('/tournaments/:id/nassau-matches', requireAuth, requireOpenSeason, withRound(async (req, res, round, send) => {
  const me = Number(req.user.id);
  const opponent = parseId(req.body?.opponent_id);
  if (!opponent || opponent === me) return res.status(400).json({ error: 'Choose an opponent' });
  if (Number(round.number_of_holes) !== 18) return res.status(400).json({ error: 'Nassau match play is only for 18-hole rounds' });
  if (Number(round.completed) === 1) return res.status(409).json({ error: 'This round is completed' });
  const { terms, error } = parseTerms(req.body);
  if (error) return res.status(400).json({ error });

  const [entered] = await pool.query(
    `SELECT player_id FROM tournament_players
     WHERE tournament_id = ? AND player_id IN (?, ?) AND (attending_status IS NULL OR attending_status <> 'no')`,
    [round.id, me, opponent]
  );
  const inRound = new Set(entered.map((r) => Number(r.player_id)));
  if (!inRound.has(me)) return res.status(400).json({ error: 'You are not playing in this round' });
  if (!inRound.has(opponent)) return res.status(400).json({ error: 'That player is not playing in this round' });
  if (await hasStarted(round.id, [me, opponent])) return res.status(409).json(STARTED);

  const low = Math.min(me, opponent);
  const high = Math.max(me, opponent);
  await pool.query(
    "DELETE FROM nassau_matches WHERE tournament_id = ? AND pair_low = ? AND pair_high = ? AND status = 'declined'",
    [round.id, low, high]
  );
  try {
    await pool.query('INSERT INTO nassau_matches SET ?', [{
      tournament_id: round.id, player_a: me, player_b: opponent, pair_low: low, pair_high: high, ...terms
    }]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You two already have a match in this round' });
    throw err;
  }
  return send(201);
}));

// POST .../:matchId/accept and .../:matchId/decline: the opponent answers.
for (const [action, status] of [['accept', 'accepted'], ['decline', 'declined']]) {
  router.post(`/tournaments/:id/nassau-matches/:matchId/${action}`, requireAuth, requireOpenSeason, withRound(async (req, res, round, send) => {
    const match = await loadMatch(round, req.params.matchId);
    if (!match) return res.status(404).json(GONE);
    if (Number(match.player_b) !== Number(req.user.id)) return res.status(403).json({ error: 'Only the player who was challenged can answer' });
    if (status === 'accepted') {
      if (Number(round.number_of_holes) !== 18) return res.status(400).json({ error: 'Nassau match play is only for 18-hole rounds' });
      if (Number(round.completed) === 1) return res.status(409).json({ error: 'This round is completed' });
      if (await hasStarted(round.id, [match.player_a, match.player_b])) return res.status(409).json(STARTED);
    }
    const [done] = await pool.query(
      "UPDATE nassau_matches SET status = ?, accepted_at = IF(? = 'accepted', NOW(), NULL) WHERE id = ? AND status = 'pending'",
      [status, status, match.id]
    );
    if (!done.affectedRows) return res.status(409).json({ error: 'That match has already been answered' });
    return send();
  }));
}

// DELETE .../:matchId: either player before play starts (an unaccepted match any
// time), or an admin.
router.delete('/tournaments/:id/nassau-matches/:matchId', requireAuth, requireOpenSeason, withRound(async (req, res, round, send) => {
  const match = await loadMatch(round, req.params.matchId);
  if (!match) return res.status(404).json(GONE);
  const ids = [Number(match.player_a), Number(match.player_b)];
  if (!(await isAdmin(req))) {
    if (!ids.includes(Number(req.user.id))) return res.status(403).json({ error: 'Only the two players can remove this match' });
    if (match.status === 'accepted' && (Number(round.completed) === 1 || await hasStarted(round.id, ids))) return res.status(409).json(STARTED);
  }
  await pool.query('DELETE FROM nassau_matches WHERE id = ?', [match.id]);
  return send();
}));

module.exports = router;
