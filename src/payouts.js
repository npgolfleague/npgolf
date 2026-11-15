// Per-tournament prize payouts, stored in tournament_payouts.
//
// Each tournament pays out from its own league's fees, so a player's prize
// money adds up separately in each league (see the league_player_totals view).
//
// The quota pot uses the same rule as the leaderboard: the tournament's
// quota_collected when it is set, otherwise paid players x the league's fee.
// It is split 50/30/20 among the top three by over/under; tied players pool
// the places they cover and share them equally (rounded down to the dollar).
// Skins and CTP payouts are the prize amounts saved on the winner rows, and
// side-game payouts are those saved on tournament_side_game_results.

const QUOTA_PRIZE_SPLIT = [0.5, 0.3, 0.2];

const computeQuotaPayouts = (rankedRows, pot) => {
  const payouts = new Map();
  let position = 0;
  while (position < rankedRows.length) {
    const overUnder = Number(rankedRows[position].over_under);
    let tied = 1;
    while (
      position + tied < rankedRows.length &&
      Number(rankedRows[position + tied].over_under) === overUnder
    ) {
      tied++;
    }

    let pooled = 0;
    for (let i = 0; i < tied; i++) {
      if (position + i < QUOTA_PRIZE_SPLIT.length) pooled += QUOTA_PRIZE_SPLIT[position + i];
    }

    const perPlayer = Math.floor(pot * (pooled / tied));
    if (perPlayer > 0) {
      for (let i = 0; i < tied; i++) {
        const playerId = Number(rankedRows[position + i].player_id);
        payouts.set(playerId, (payouts.get(playerId) || 0) + perPlayer);
      }
    }
    position += tied;
  }
  return payouts;
};

// Recalculate and store the payouts for one tournament.
const rebuildTournamentPayouts = async (db, tournamentId) => {
  const [tournamentRows] = await db.query(
    `SELECT t.id, t.number_of_holes, t.quota_collected,
            ls.tournament_fee_18_holes, ls.tournament_fee_9_holes
     FROM tournament t
     LEFT JOIN league_settings ls ON ls.league_id = t.league_id
     WHERE t.id = ?
     LIMIT 1`,
    [tournamentId]
  );
  const tournament = tournamentRows[0];
  if (!tournament) return 0;

  let pot;
  if (tournament.quota_collected != null) {
    pot = Number(tournament.quota_collected) || 0;
  } else {
    const fee = Number(
      Number(tournament.number_of_holes) === 9
        ? tournament.tournament_fee_9_holes
        : tournament.tournament_fee_18_holes
    ) || 0;
    const [paidRows] = await db.query(
      'SELECT SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS paid_players FROM tournament_players WHERE tournament_id = ?',
      [tournamentId]
    );
    pot = (Number(paidRows[0]?.paid_players) || 0) * fee;
  }

  const [rankedRows] = await db.query(
    `SELECT player_id, over_under
     FROM tournament_paradise_points
     WHERE tournament_id = ?
     ORDER BY over_under DESC, player_id ASC`,
    [tournamentId]
  );
  const [skinRows] = await db.query(
    `SELECT player_id, SUM(COALESCE(prize_money, 0)) AS total
     FROM tournament_skin_winners WHERE tournament_id = ? GROUP BY player_id`,
    [tournamentId]
  );
  const [ctpRows] = await db.query(
    `SELECT player_id, SUM(COALESCE(prize_money, 0)) AS total
     FROM tournament_ctp_winners WHERE tournament_id = ? GROUP BY player_id`,
    [tournamentId]
  );

  const [sideGameRows] = await db.query(
    `SELECT player_id, SUM(COALESCE(prize_money, 0)) AS total
     FROM tournament_side_game_results WHERE tournament_id = ? GROUP BY player_id`,
    [tournamentId]
  );

  const rows = [];
  for (const [playerId, amount] of computeQuotaPayouts(rankedRows, pot)) {
    rows.push([tournamentId, playerId, 'quota', amount]);
  }
  for (const r of skinRows) {
    if (Number(r.total) > 0) rows.push([tournamentId, Number(r.player_id), 'skins', Number(Number(r.total).toFixed(2))]);
  }
  for (const r of ctpRows) {
    if (Number(r.total) > 0) rows.push([tournamentId, Number(r.player_id), 'ctp', Number(Number(r.total).toFixed(2))]);
  }
  for (const r of sideGameRows) {
    if (Number(r.total) > 0) rows.push([tournamentId, Number(r.player_id), 'side_games', Number(Number(r.total).toFixed(2))]);
  }

  await db.query('DELETE FROM tournament_payouts WHERE tournament_id = ?', [tournamentId]);
  if (rows.length > 0) {
    await db.query(
      'INSERT INTO tournament_payouts (tournament_id, player_id, category, amount) VALUES ?',
      [rows]
    );
  }
  return rows.length;
};

// Recalculate payouts for every tournament in a league. Returns how many
// players in the league have any payout.
const rebuildLeaguePayouts = async (db, leagueId) => {
  const [tournaments] = await db.query('SELECT id FROM tournament WHERE league_id = ?', [leagueId]);
  for (const t of tournaments) {
    await rebuildTournamentPayouts(db, t.id);
  }
  const [countRows] = await db.query(
    `SELECT COUNT(DISTINCT po.player_id) AS players
     FROM tournament_payouts po JOIN tournament t ON t.id = po.tournament_id
     WHERE t.league_id = ?`,
    [leagueId]
  );
  return Number(countRows[0]?.players) || 0;
};

module.exports = { computeQuotaPayouts, rebuildTournamentPayouts, rebuildLeaguePayouts };
