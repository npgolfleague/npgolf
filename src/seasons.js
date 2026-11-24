// Seasons: the current season, season-scoped standings, closing (archiving)
// a season and rolling a league over to a new one.
//
// Totals are always calculated from per-tournament results
// (tournament_paradise_points, tournament_payouts), grouped by
// tournament.season_id in the league_player_season_totals view. A new season
// therefore starts at zero without deleting anything.
//
// Closing a season freezes its final standings in season_archive_standings,
// so later payout recalculations can't change last season's numbers, and
// makes the season read-only (see assertSeasonOpen).

const { rebuildTournamentPayouts } = require('./payouts');
const { quotaForHoles } = require('./utils/leagueQuota');

class SeasonError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const QUOTA_MODES = new Set(['keep', 'set']);

// The league's current season row (leagues.season_year), created if missing.
const getCurrentSeason = async (db, leagueId) => {
  const [leagueRows] = await db.query('SELECT season_year FROM leagues WHERE id = ? LIMIT 1', [leagueId]);
  if (leagueRows.length === 0) throw new SeasonError(404, 'League not found');
  const year = Number(leagueRows[0].season_year) || new Date().getFullYear();
  const select = () => db.query(
    'SELECT * FROM league_seasons WHERE league_id = ? AND season_year = ? LIMIT 1',
    [leagueId, year]
  );
  let [rows] = await select();
  if (rows.length > 0) return rows[0];
  // Insert only when missing: INSERT IGNORE would use up an id on every call.
  await db.query('INSERT IGNORE INTO league_seasons (league_id, season_year) VALUES (?, ?)', [leagueId, year]);
  [rows] = await select();
  return rows[0];
};

const getSeason = async (db, leagueId, seasonId) => {
  const [rows] = await db.query(
    'SELECT * FROM league_seasons WHERE id = ? AND league_id = ? LIMIT 1',
    [seasonId, leagueId]
  );
  return rows[0] || null;
};

// Throws a 409 when the season is closed. A null season id is treated as open.
const assertSeasonOpen = async (db, seasonId) => {
  if (!seasonId) return;
  const [rows] = await db.query('SELECT season_year, status FROM league_seasons WHERE id = ? LIMIT 1', [seasonId]);
  if (rows[0] && rows[0].status === 'closed') {
    throw new SeasonError(409, `The ${rows[0].season_year} season is closed. Reopen it to make changes.`);
  }
};

// Final order: the champion, then the other finalists by playoff points
// (regular points break ties), then everyone else by regular + playoff points.
// Without playoffs it is simply by FedEx points.
const rankSeasonStandings = (rows, championPlayerId) => {
  const championId = Number(championPlayerId) || null;
  const hasPlayoffs = rows.some((r) => Number(r.playoff_points) !== 0);
  const isFinalist = (r) => Number(r.is_finalist) === 1;
  const sortKey = (r) => (hasPlayoffs
    ? Number(r.regular_points) + Number(r.playoff_points)
    : Number(r.fedex_points));

  return [...rows].sort((a, b) => {
    if (championId) {
      if (Number(a.player_id) === championId) return -1;
      if (Number(b.player_id) === championId) return 1;
    }
    if (isFinalist(a) !== isFinalist(b)) return isFinalist(a) ? -1 : 1;
    if (isFinalist(a)) {
      const diff = Number(b.playoff_points) - Number(a.playoff_points)
        || Number(b.regular_points) - Number(a.regular_points);
      if (diff) return diff;
    }
    return sortKey(b) - sortKey(a)
      || Number(b.prize_money) - Number(a.prize_money)
      || String(a.player_name).localeCompare(String(b.player_name));
  });
};

// Live (calculated) standings for a season, best first.
const computeSeasonStandings = async (db, season) => {
  const [rows] = await db.query(
    `SELECT t.player_id, p.name AS player_name,
            t.fedex_points, t.tournaments_played,
            t.prize_quota, t.prize_skins, t.prize_ctp, t.prize_side_games, t.prize_playoffs, t.prize_money,
            EXISTS (SELECT 1 FROM tournament_playoff_points fp
                    WHERE fp.season_id = t.season_id AND fp.player_id = t.player_id
                      AND fp.bracket_type = 'playoff' AND fp.playoff_week = 2) AS is_finalist,
            COALESCE(sps.regular_points, 0) AS regular_points,
            COALESCE(sps.playoff_points, 0) AS playoff_points,
            COALESCE(sps.losers_bracket_points, 0) AS losers_bracket_points,
            lp.quota_18, lp.quota_9
     FROM league_player_season_totals t
     JOIN players p ON p.id = t.player_id
     JOIN league_players lp ON lp.league_id = t.league_id AND lp.player_id = t.player_id
     LEFT JOIN season_player_stats sps ON sps.season_id = t.season_id AND sps.player_id = t.player_id
     WHERE t.season_id = ?
       AND (t.tournaments_played > 0 OR sps.player_id IS NOT NULL)`,
    [season.id]
  );

  const ranked = rankSeasonStandings(rows, season.champion_player_id);

  return ranked.map((r, i) => ({
    final_rank: i + 1,
    player_id: Number(r.player_id),
    player_name: r.player_name,
    fedex_points: Number(r.fedex_points) || 0,
    regular_points: Number(r.regular_points) || 0,
    playoff_points: Number(r.playoff_points) || 0,
    losers_bracket_points: Number(r.losers_bracket_points) || 0,
    tournaments_played: Number(r.tournaments_played) || 0,
    prize_quota: Number(r.prize_quota) || 0,
    prize_skins: Number(r.prize_skins) || 0,
    prize_ctp: Number(r.prize_ctp) || 0,
    prize_side_games: Number(r.prize_side_games) || 0,
    prize_playoffs: Number(r.prize_playoffs) || 0,
    prize_money: Number(r.prize_money) || 0,
    end_quota_18: r.quota_18 == null ? null : Number(r.quota_18),
    end_quota_9: r.quota_9 == null ? null : Number(r.quota_9)
  }));
};

const getArchivedStandings = async (db, seasonId) => {
  const [rows] = await db.query(
    'SELECT * FROM season_archive_standings WHERE season_id = ? ORDER BY final_rank ASC',
    [seasonId]
  );
  return rows.map((r) => ({
    ...r,
    player_id: Number(r.player_id),
    final_rank: Number(r.final_rank),
    fedex_points: Number(r.fedex_points),
    regular_points: Number(r.regular_points),
    playoff_points: Number(r.playoff_points),
    losers_bracket_points: Number(r.losers_bracket_points),
    tournaments_played: Number(r.tournaments_played),
    prize_quota: Number(r.prize_quota),
    prize_skins: Number(r.prize_skins),
    prize_ctp: Number(r.prize_ctp),
    prize_side_games: Number(r.prize_side_games),
    prize_playoffs: Number(r.prize_playoffs) || 0,
    prize_money: Number(r.prize_money),
    end_quota_18: r.end_quota_18 == null ? null : Number(r.end_quota_18),
    end_quota_9: r.end_quota_9 == null ? null : Number(r.end_quota_9)
  }));
};

// Tournaments in a season, with whether each is completed (has results) and
// whether it has any scores at all.
const getSeasonTournaments = async (db, leagueId, seasonId) => {
  const [rows] = await db.query(
    `SELECT t.id, t.date, t.number_of_holes, t.playoff_stage, c.name AS course_name,
            EXISTS (SELECT 1 FROM tournament_paradise_points x WHERE x.tournament_id = t.id) AS is_completed,
            EXISTS (SELECT 1 FROM scores s WHERE s.tournament_id = t.id) AS has_scores
     FROM tournament t
     LEFT JOIN course c ON c.id = t.course_id
     WHERE t.league_id = ? AND t.season_id = ?
     ORDER BY t.date ASC, t.id ASC`,
    [leagueId, seasonId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    date: r.date,
    number_of_holes: Number(r.number_of_holes),
    playoff_stage: r.playoff_stage,
    course_name: r.course_name,
    is_completed: Number(r.is_completed) === 1,
    has_scores: Number(r.has_scores) === 1
  }));
};

const withPlayerNames = async (db, season) => {
  const ids = [season.champion_player_id, season.champion_tiebreak_player_id, season.losers_winner_player_id]
    .filter(Boolean);
  const names = new Map();
  if (ids.length > 0) {
    const [rows] = await db.query('SELECT id, name FROM players WHERE id IN (?)', [ids]);
    rows.forEach((r) => names.set(Number(r.id), r.name));
  }
  return {
    id: Number(season.id),
    league_id: Number(season.league_id),
    season_year: Number(season.season_year),
    status: season.status || 'open',
    closed_at: season.closed_at || null,
    championship_pot: Number(season.championship_pot) || 0,
    losers_bracket_pot: Number(season.losers_bracket_pot) || 0,
    champion_player_id: season.champion_player_id || null,
    champion_name: names.get(Number(season.champion_player_id)) || null,
    losers_winner_player_id: season.losers_winner_player_id || null,
    losers_winner_name: names.get(Number(season.losers_winner_player_id)) || null
  };
};

const listSeasons = async (db, leagueId) => {
  const current = await getCurrentSeason(db, leagueId);
  const [rows] = await db.query(
    `SELECT ls.*,
            (SELECT COUNT(*) FROM tournament t WHERE t.season_id = ls.id) AS tournament_count
     FROM league_seasons ls
     WHERE ls.league_id = ?
     ORDER BY ls.season_year DESC`,
    [leagueId]
  );
  const seasons = [];
  for (const row of rows) {
    seasons.push({
      ...(await withPlayerNames(db, row)),
      tournament_count: Number(row.tournament_count) || 0,
      is_current: Number(row.id) === Number(current.id)
    });
  }
  return seasons;
};

const getSeasonDetail = async (db, leagueId, seasonId) => {
  const season = await getSeason(db, leagueId, seasonId);
  if (!season) throw new SeasonError(404, 'Season not found');
  const current = await getCurrentSeason(db, leagueId);
  const archived = season.status === 'closed' ? await getArchivedStandings(db, season.id) : [];
  const frozen = archived.length > 0;
  return {
    season: { ...(await withPlayerNames(db, season)), is_current: Number(season.id) === Number(current.id) },
    frozen,
    standings: frozen ? archived : await computeSeasonStandings(db, season),
    tournaments: await getSeasonTournaments(db, leagueId, season.id)
  };
};

// What would block or need attention when closing the current season.
const getRolloverPreview = async (db, leagueId) => {
  const season = await getCurrentSeason(db, leagueId);
  const tournaments = await getSeasonTournaments(db, leagueId, season.id);
  const [settingsRows] = await db.query('SELECT playoff_format FROM league_settings WHERE league_id = ? LIMIT 1', [leagueId]);
  const playoffFormat = settingsRows[0]?.playoff_format || 'none';
  const nextYear = Number(season.season_year) + 1;
  const [nextRows] = await db.query(
    'SELECT id, status FROM league_seasons WHERE league_id = ? AND season_year = ? LIMIT 1',
    [leagueId, nextYear]
  );
  const [memberRows] = await db.query('SELECT COUNT(*) AS n FROM league_players WHERE league_id = ?', [leagueId]);

  const inProgress = tournaments.filter((t) => !t.is_completed && t.has_scores);
  const unplayed = tournaments.filter((t) => !t.is_completed && !t.has_scores);

  const blockers = [];
  if (season.status === 'closed') blockers.push(`The ${season.season_year} season is already closed.`);
  if (inProgress.length > 0) {
    blockers.push(`${inProgress.length} tournament(s) have scores but aren't completed. Complete or delete them first.`);
  }

  const warnings = [];
  if (unplayed.length > 0) {
    warnings.push(`${unplayed.length} tournament(s) have no scores yet. They can be moved to the new season.`);
  }
  if (playoffFormat === 'fedex_cup' && !season.champion_player_id) {
    warnings.push('No champion has been recorded for this season.');
  }
  if (nextRows[0]?.status === 'closed') {
    blockers.push(`The ${nextYear} season already exists and is closed.`);
  }

  return {
    season: await withPlayerNames(db, season),
    next_season_year: nextYear,
    playoff_format: playoffFormat,
    member_count: Number(memberRows[0]?.n) || 0,
    tournament_count: tournaments.length,
    completed_count: tournaments.filter((t) => t.is_completed).length,
    in_progress: inProgress,
    unplayed,
    blockers,
    warnings,
    can_rollover: blockers.length === 0
  };
};

// Freeze a season's standings and mark it closed. Runs inside the caller's
// transaction.
const closeSeason = async (db, season, userId) => {
  // Bring payouts up to date one last time before freezing.
  const [tRows] = await db.query('SELECT id FROM tournament WHERE season_id = ?', [season.id]);
  for (const t of tRows) await rebuildTournamentPayouts(db, t.id);

  const standings = await computeSeasonStandings(db, season);
  await db.query('DELETE FROM season_archive_standings WHERE season_id = ?', [season.id]);
  for (const s of standings) {
    await db.query(
      `INSERT INTO season_archive_standings (
         season_id, player_id, player_name, final_rank, fedex_points, regular_points, playoff_points,
         losers_bracket_points, tournaments_played, prize_quota, prize_skins, prize_ctp,
         prize_side_games, prize_playoffs, prize_money, end_quota_18, end_quota_9
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        season.id, s.player_id, s.player_name, s.final_rank, s.fedex_points, s.regular_points, s.playoff_points,
        s.losers_bracket_points, s.tournaments_played, s.prize_quota, s.prize_skins, s.prize_ctp,
        s.prize_side_games, s.prize_playoffs, s.prize_money, s.end_quota_18, s.end_quota_9
      ]
    );
  }
  await db.query(
    "UPDATE league_seasons SET status = 'closed', closed_at = NOW(), closed_by = ? WHERE id = ?",
    [userId || null, season.id]
  );
  return standings.length;
};

const normalizeRolloverOptions = (body = {}, defaultYear) => {
  const newYear = body.new_season_year == null || body.new_season_year === ''
    ? defaultYear
    : Number(body.new_season_year);
  if (!Number.isInteger(newYear) || newYear < 2000 || newYear > 2100) {
    throw new SeasonError(400, 'Invalid new season year');
  }
  const quotaMode = body.quota_mode == null ? 'keep' : String(body.quota_mode);
  if (!QUOTA_MODES.has(quotaMode)) throw new SeasonError(400, 'Invalid quota option');

  const toQuota = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 99) throw new SeasonError(400, 'Starting quota must be a whole number from 0 to 99');
    return n;
  };
  const quota18 = quotaMode === 'set' ? toQuota(body.quota_18) : null;
  const quota9 = quotaMode === 'set' ? toQuota(body.quota_9) : null;
  if (quotaMode === 'set' && quota18 === null && quota9 === null) {
    throw new SeasonError(400, 'Enter a starting 18-hole or 9-hole quota');
  }

  return {
    newYear,
    quotaMode,
    quota18,
    quota9,
    carryPots: Boolean(body.carry_pots),
    moveUnplayed: body.move_unplayed === undefined ? true : Boolean(body.move_unplayed)
  };
};

// Close the current season and start the next one. `pool` must be a mysql2
// pool; this takes a connection and runs everything in one transaction.
const rolloverSeason = async (pool, leagueId, body, userId) => {
  const connection = await pool.getConnection();
  let inTransaction = false;
  try {
    const preview = await getRolloverPreview(connection, leagueId);
    if (!preview.can_rollover) {
      throw new SeasonError(409, preview.blockers[0], { blockers: preview.blockers });
    }
    const opts = normalizeRolloverOptions(body, preview.next_season_year);
    const oldSeason = await getCurrentSeason(connection, leagueId);
    if (opts.newYear <= Number(oldSeason.season_year)) {
      throw new SeasonError(400, `The new season must be after ${oldSeason.season_year}`);
    }

    await connection.beginTransaction();
    inTransaction = true;

    // Unplayed tournaments move first so they aren't part of the archive.
    await connection.query(
      'INSERT IGNORE INTO league_seasons (league_id, season_year) VALUES (?, ?)',
      [leagueId, opts.newYear]
    );
    const [newRows] = await connection.query(
      'SELECT * FROM league_seasons WHERE league_id = ? AND season_year = ? LIMIT 1 FOR UPDATE',
      [leagueId, opts.newYear]
    );
    const newSeason = newRows[0];
    if (newSeason.status === 'closed') throw new SeasonError(409, `The ${opts.newYear} season is closed`);

    let movedTournaments = 0;
    if (opts.moveUnplayed && preview.unplayed.length > 0) {
      const ids = preview.unplayed.map((t) => t.id);
      const [moveResult] = await connection.query(
        'UPDATE tournament SET season_id = ? WHERE id IN (?) AND league_id = ?',
        [newSeason.id, ids, leagueId]
      );
      movedTournaments = moveResult.affectedRows;
    }

    const archivedPlayers = await closeSeason(connection, oldSeason, userId);

    if (opts.carryPots) {
      await connection.query(
        'UPDATE league_seasons SET championship_pot = ?, losers_bracket_pot = ? WHERE id = ?',
        [oldSeason.championship_pot || 0, oldSeason.losers_bracket_pot || 0, newSeason.id]
      );
    }

    let quotaPlayersReset = 0;
    if (opts.quotaMode === 'set') {
      const sets = [];
      const vals = [];
      // Setting one length sets the other to match.
      const start = { quota_9: opts.quota9, quota_18: opts.quota18 };
      sets.push('quota_18 = ?', 'quota_9 = ?');
      vals.push(quotaForHoles(start, 18), quotaForHoles(start, 9));
      const [qr] = await connection.query(
        `UPDATE league_players SET ${sets.join(', ')} WHERE league_id = ?`,
        [...vals, leagueId]
      );
      quotaPlayersReset = qr.affectedRows;
      // Quota is the average of the rolling history, so the history has to go
      // too or the next completion would bring the old quota straight back.
      await connection.query('DELETE FROM quota WHERE league_id = ?', [leagueId]);
      await connection.query('DELETE FROM skins_quota WHERE league_id = ?', [leagueId]);
    }

    await connection.query('UPDATE leagues SET season_year = ? WHERE id = ?', [opts.newYear, leagueId]);

    await connection.commit();
    inTransaction = false;

    return {
      closed_season_id: Number(oldSeason.id),
      closed_season_year: Number(oldSeason.season_year),
      new_season_id: Number(newSeason.id),
      new_season_year: opts.newYear,
      archived_players: archivedPlayers,
      moved_tournaments: movedTournaments,
      quota_mode: opts.quotaMode,
      quota_players_reset: quotaPlayersReset,
      carried_pots: opts.carryPots
    };
  } catch (err) {
    if (inTransaction) await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// Reopen a closed season for corrections. The frozen standings are kept
// until it's closed again (which re-freezes them).
const reopenSeason = async (db, leagueId, seasonId) => {
  const season = await getSeason(db, leagueId, seasonId);
  if (!season) throw new SeasonError(404, 'Season not found');
  if (season.status !== 'closed') throw new SeasonError(409, 'That season is already open');
  await db.query("UPDATE league_seasons SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ?", [season.id]);
  return { id: Number(season.id), season_year: Number(season.season_year), status: 'open' };
};

// Close a past season again after a reopen (not the current one; use rollover for that).
const recloseSeason = async (pool, leagueId, seasonId, userId) => {
  const connection = await pool.getConnection();
  try {
    const season = await getSeason(connection, leagueId, seasonId);
    if (!season) throw new SeasonError(404, 'Season not found');
    if (season.status === 'closed') throw new SeasonError(409, 'That season is already closed');
    const current = await getCurrentSeason(connection, leagueId);
    if (Number(current.id) === Number(season.id)) {
      throw new SeasonError(409, 'Use Start New Season to close the current season');
    }
    await connection.beginTransaction();
    try {
      const archived = await closeSeason(connection, season, userId);
      await connection.commit();
      return { id: Number(season.id), season_year: Number(season.season_year), status: 'closed', archived_players: archived };
    } catch (err) {
      await connection.rollback();
      throw err;
    }
  } finally {
    connection.release();
  }
};

module.exports = {
  SeasonError,
  getCurrentSeason,
  assertSeasonOpen,
  rankSeasonStandings,
  computeSeasonStandings,
  listSeasons,
  getSeasonDetail,
  getRolloverPreview,
  rolloverSeason,
  reopenSeason,
  recloseSeason,
  normalizeRolloverOptions
};
