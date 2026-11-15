// Side games for one tournament: load the setup, work out the results on
// completion and store them. The scoring rules are in src/utils/sideGames.js.
//
// Results are written to tournament_side_game_results (and the Blind Draw to
// tournament_side_game_teams). src/payouts.js adds each player's side-game
// prize money to tournament_payouts as category 'side_games'.

const {
  GAME_TYPES,
  GAME_LABELS,
  drawBlindTeams,
  scoreBlindDraw,
  nassauSegments,
  scoreQuotaNassau,
  scoreBirdiePot,
  gamePot
} = require('./utils/sideGames');

const isGameType = (value) => GAME_TYPES.includes(value);

// Each scored hole with the player's quota points and effective par
// (the player's tee, otherwise the first tee for their gender - the same rule
// tournament completion uses).
const loadHoleRows = async (db, tournamentId) => {
  const [rows] = await db.query(
    `SELECT s.player_id,
            h.hole_number,
            s.score,
            CAST(COALESCE(s.quota, 0) AS SIGNED) AS points,
            COALESCE(ht.par, ht_fb.par) AS par
     FROM scores s
     JOIN players p ON p.id = s.player_id
     JOIN hole h ON h.id = s.hole_id
     LEFT JOIN tournament_players tp
       ON tp.player_id = s.player_id AND tp.tournament_id = s.tournament_id
     LEFT JOIN hole_tee ht ON ht.hole_id = h.id AND ht.tee_id = tp.tee_id
     LEFT JOIN hole_tee ht_fb ON ht_fb.id = (
       SELECT ht3.id FROM hole_tee ht3
       JOIN course_tee ct3 ON ct3.id = ht3.tee_id
       WHERE ht3.hole_id = h.id
         AND ct3.gender = CASE WHEN p.sex = 'F' THEN 'F' ELSE 'M' END
       ORDER BY ct3.id ASC LIMIT 1
     )
     WHERE s.tournament_id = ?
     ORDER BY s.player_id, h.hole_number`,
    [tournamentId]
  );
  return rows.map((row) => ({
    player_id: Number(row.player_id),
    hole_number: Number(row.hole_number),
    score: Number(row.score),
    points: Number(row.points) || 0,
    par: row.par == null ? null : Number(row.par)
  }));
};

const loadGames = async (db, tournamentId) => {
  const [games] = await db.query(
    `SELECT g.game_type, g.fee, g.collected,
            COALESCE(SUM(CASE WHEN e.paid = 1 THEN 1 ELSE 0 END), 0) AS paid_count
     FROM tournament_side_games g
     LEFT JOIN tournament_side_game_entries e
       ON e.tournament_id = g.tournament_id AND e.game_type = g.game_type
     WHERE g.tournament_id = ?
     GROUP BY g.id, g.game_type, g.fee, g.collected
     ORDER BY FIELD(g.game_type, 'blind_draw', 'quota_nassau', 'birdie_pot')`,
    [tournamentId]
  );
  return games.map((g) => ({
    game_type: g.game_type,
    label: GAME_LABELS[g.game_type],
    fee: Number(g.fee) || 0,
    collected: g.collected == null ? null : Number(g.collected),
    paid_count: Number(g.paid_count) || 0,
    pot: gamePot({ collected: g.collected, fee: g.fee, paidCount: g.paid_count })
  }));
};

// Reuse the saved draw when it holds exactly these entrants; otherwise draw again.
const loadOrDrawTeams = async (db, tournamentId, entrantIds, rng) => {
  const [saved] = await db.query(
    'SELECT team_no, player_id FROM tournament_side_game_teams WHERE tournament_id = ? ORDER BY team_no, player_id',
    [tournamentId]
  );
  const savedIds = saved.map((r) => Number(r.player_id)).sort((a, b) => a - b);
  const wanted = [...entrantIds].sort((a, b) => a - b);

  if (savedIds.length > 0 && savedIds.join(',') === wanted.join(',')) {
    const byTeam = new Map();
    for (const row of saved) {
      const teamNo = Number(row.team_no);
      if (!byTeam.has(teamNo)) byTeam.set(teamNo, []);
      byTeam.get(teamNo).push(Number(row.player_id));
    }
    return [...byTeam.entries()].map(([team_no, player_ids]) => ({ team_no, player_ids }));
  }

  const teams = drawBlindTeams(entrantIds, rng);
  await db.query('DELETE FROM tournament_side_game_teams WHERE tournament_id = ?', [tournamentId]);
  const rows = teams.flatMap((team) => team.player_ids.map((playerId) => [tournamentId, team.team_no, playerId]));
  if (rows.length > 0) {
    await db.query('INSERT INTO tournament_side_game_teams (tournament_id, team_no, player_id) VALUES ?', [rows]);
  }
  return teams;
};

// Work out and store every side game for a tournament. Run after
// tournament_paradise_points is written (it supplies each player's quota and
// over/under) and before rebuildTournamentPayouts.
const rebuildTournamentSideGames = async (db, tournamentId, { rng = Math.random } = {}) => {
  const games = await loadGames(db, tournamentId);
  await db.query('DELETE FROM tournament_side_game_results WHERE tournament_id = ?', [tournamentId]);

  if (!games.some((g) => g.game_type === 'blind_draw')) {
    await db.query('DELETE FROM tournament_side_game_teams WHERE tournament_id = ?', [tournamentId]);
  }
  if (games.length === 0) return 0;

  const [resultRows] = await db.query(
    'SELECT player_id, player_quota, over_under FROM tournament_paradise_points WHERE tournament_id = ?',
    [tournamentId]
  );
  const quotaById = new Map(resultRows.map((r) => [Number(r.player_id), Number(r.player_quota) || 0]));
  const overUnderById = new Map(resultRows.map((r) => [Number(r.player_id), Number(r.over_under) || 0]));

  const [entryRows] = await db.query(
    'SELECT game_type, player_id FROM tournament_side_game_entries WHERE tournament_id = ? AND paid = 1',
    [tournamentId]
  );
  // Only entrants who have a result for the night can win.
  const entrantsFor = (gameType) => entryRows
    .filter((r) => r.game_type === gameType && quotaById.has(Number(r.player_id)))
    .map((r) => Number(r.player_id));

  const holeRows = await loadHoleRows(db, tournamentId);
  const rows = [];

  for (const game of games) {
    const entrants = entrantsFor(game.game_type);
    if (entrants.length === 0) continue;
    const entrantSet = new Set(entrants);
    const entrantHoles = holeRows.filter((r) => entrantSet.has(r.player_id));

    let gameRows = [];
    if (game.game_type === 'blind_draw') {
      const teams = await loadOrDrawTeams(db, tournamentId, entrants, rng);
      gameRows = scoreBlindDraw(teams, overUnderById, game.pot);
    } else if (game.game_type === 'quota_nassau') {
      const segments = nassauSegments(holeRows.map((r) => r.hole_number));
      gameRows = scoreQuotaNassau(entrantHoles, quotaById, segments, game.pot);
    } else if (game.game_type === 'birdie_pot') {
      gameRows = scoreBirdiePot(entrantHoles, game.pot);
    }

    for (const r of gameRows) {
      rows.push([
        tournamentId, game.game_type, r.segment, r.player_id, r.team_no,
        r.score, r.shares, r.is_winner ? 1 : 0, r.prize_money
      ]);
    }
  }

  if (rows.length > 0) {
    await db.query(
      `INSERT INTO tournament_side_game_results
         (tournament_id, game_type, segment, player_id, team_no, score, shares, is_winner, prize_money)
       VALUES ?`,
      [rows]
    );
  }
  return rows.length;
};

// Everything the screens and the results email show for one tournament.
const getTournamentSideGames = async (db, tournamentId) => {
  const games = await loadGames(db, tournamentId);

  const [entries] = await db.query(
    `SELECT e.game_type, e.player_id, e.paid
     FROM tournament_side_game_entries e
     WHERE e.tournament_id = ?`,
    [tournamentId]
  );
  const [teams] = await db.query(
    `SELECT t.team_no, t.player_id, p.name
     FROM tournament_side_game_teams t JOIN players p ON p.id = t.player_id
     WHERE t.tournament_id = ?
     ORDER BY t.team_no, p.name`,
    [tournamentId]
  );
  const [results] = await db.query(
    `SELECT r.game_type, r.segment, r.player_id, p.name, r.team_no, r.score, r.shares, r.is_winner, r.prize_money
     FROM tournament_side_game_results r JOIN players p ON p.id = r.player_id
     WHERE r.tournament_id = ?
     ORDER BY r.game_type, r.segment, r.score DESC, r.shares DESC, p.name`,
    [tournamentId]
  );

  return {
    games,
    entries: entries.map((e) => ({ game_type: e.game_type, player_id: Number(e.player_id), paid: Boolean(e.paid) })),
    teams: teams.map((t) => ({ team_no: Number(t.team_no), player_id: Number(t.player_id), name: t.name })),
    results: results.map((r) => ({
      game_type: r.game_type,
      segment: r.segment,
      player_id: Number(r.player_id),
      name: r.name,
      team_no: r.team_no == null ? null : Number(r.team_no),
      score: r.score == null ? null : Number(r.score),
      shares: r.shares == null ? null : Number(r.shares),
      is_winner: Boolean(r.is_winner),
      prize_money: Number(r.prize_money) || 0
    }))
  };
};

// League defaults, one entry per game type (missing rows come back as off).
const getLeagueSideGameDefaults = async (db, leagueId) => {
  const [rows] = await db.query(
    'SELECT game_type, enabled, fee_9, fee_18 FROM league_side_game_defaults WHERE league_id = ?',
    [leagueId]
  );
  const byType = new Map(rows.map((r) => [r.game_type, r]));
  return GAME_TYPES.map((gameType) => {
    const row = byType.get(gameType);
    return {
      game_type: gameType,
      label: GAME_LABELS[gameType],
      enabled: Boolean(row?.enabled),
      fee_9: row ? Number(row.fee_9) : 2,
      fee_18: row ? Number(row.fee_18) : 5
    };
  });
};

// Turn on a new tournament's side games from its league's defaults.
const applyLeagueDefaults = async (db, leagueId, tournamentId, numberOfHoles) => {
  const defaults = await getLeagueSideGameDefaults(db, leagueId);
  const rows = defaults
    .filter((d) => d.enabled)
    .map((d) => [tournamentId, d.game_type, Number(numberOfHoles) === 9 ? d.fee_9 : d.fee_18]);
  if (rows.length > 0) {
    await db.query(
      'INSERT IGNORE INTO tournament_side_games (tournament_id, game_type, fee) VALUES ?',
      [rows]
    );
  }
  return rows.length;
};

module.exports = {
  isGameType,
  rebuildTournamentSideGames,
  getTournamentSideGames,
  getLeagueSideGameDefaults,
  applyLeagueDefaults
};
