// FedEx Cup playoff rules.
//
// Everything in this file is plain data in, data out: no database access.
// The tournament completion route loads the data, calls these functions, and
// saves the results. Keeping the rules here means they can be tested directly
// (see __tests__/playoffs.test.js).
//
// Rules (as set by the league commissioner):
// - Ties always share points: the tied places' points are added up and split
//   evenly, rounded up to a whole number. Names never decide points.
// - Exception: a tie for 1st place in the final round. 1st place goes to the
//   tied player with the most regular-season points; if still tied, to the
//   winner of a 20 ft putt-off (recorded by an admin). The rest of the tied
//   players share the following places.
// - Champion: the finalist with the most playoff points (seed + semifinal
//   performance + final performance). Regular-season points do not count,
//   except as the first tiebreaker. Then the putt-off.

const PLAYOFF_STAGE = Object.freeze({
  REGULAR: 'regular',
  SEMIFINAL: 'semifinal',
  FINAL: 'final'
});

// Regular-season weekly points: 1st-10th get 100..10, everyone below gets 1.
const REGULAR_SEASON_POINTS = Object.freeze([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]);
const PLAYOFF_SEED_POINTS = Object.freeze([100, 90, 80, 70, 60, 50, 40, 30]);
const PLAYOFF_FINAL_POINTS = Object.freeze([200, 90, 80, 70, 60, 50, 40, 30]);
const LOSERS_BRACKET_POINTS = Object.freeze([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]);

const SEMIFINAL_FIELD_SIZE = 8;
const FINAL_FIELD_SIZE = 4;

function numericValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPointsForRank(rank, pointsTable) {
  if (!Array.isArray(pointsTable) || pointsTable.length === 0) {
    return 0;
  }

  const index = Math.max(0, Math.min(Number(rank) - 1, pointsTable.length - 1));
  return numericValue(pointsTable[index]);
}

// Highest score first. Name/id only keep the display order stable; they never
// affect points because tied players always share.
function sortByScore(rows, scoreKey = 'over_under') {
  return [...rows].sort((a, b) => {
    const scoreA = numericValue(a?.[scoreKey]);
    const scoreB = numericValue(b?.[scoreKey]);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const nameA = String(a?.name || '');
    const nameB = String(b?.name || '');
    const nameCompare = nameA.localeCompare(nameB);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return numericValue(a?.player_id) - numericValue(b?.player_id);
  });
}

// The top `cutoffCount` players, plus everyone tied with the last one in.
function selectTopWithTies(rows, cutoffCount, scoreKey = 'over_under') {
  const sorted = sortByScore(rows, scoreKey);
  if (sorted.length === 0 || cutoffCount <= 0) {
    return [];
  }

  if (sorted.length <= cutoffCount) {
    return sorted;
  }

  const cutoffScore = numericValue(sorted[cutoffCount - 1]?.[scoreKey]);
  return sorted.filter((row) => numericValue(row?.[scoreKey]) >= cutoffScore);
}

// Ranks rows by score and awards points from the table. Tied players share:
// they all get the same rank and the average of the places they cover.
// `firstRank` lets a caller start below 1st (used when 1st was decided by a
// tiebreaker).
function awardRankedPoints(rows, pointsTable, scoreKey = 'over_under', firstRank = 1) {
  const sorted = sortByScore(rows, scoreKey);
  const awards = [];

  let index = 0;
  while (index < sorted.length) {
    const currentScore = numericValue(sorted[index]?.[scoreKey]);
    let nextIndex = index + 1;

    while (nextIndex < sorted.length && numericValue(sorted[nextIndex]?.[scoreKey]) === currentScore) {
      nextIndex += 1;
    }

    const startRank = index + firstRank;
    const tieGroupSize = nextIndex - index;
    const totalPoints = Array.from({ length: tieGroupSize }, (_unused, offset) => (
      getPointsForRank(startRank + offset, pointsTable)
    )).reduce((sum, value) => sum + value, 0);
    // Points are whole numbers; a fractional share is always rounded up.
    const averagePoints = Math.ceil(totalPoints / tieGroupSize);

    for (let tieIndex = 0; tieIndex < tieGroupSize; tieIndex += 1) {
      const player = sorted[index + tieIndex];
      awards.push({
        ...player,
        rank_position: startRank,
        tie_group_size: tieGroupSize,
        points_awarded: averagePoints,
        score_value: currentScore
      });
    }

    index = nextIndex;
  }

  return awards;
}

function sumPoints(pointsTable, startRank, endRank) {
  let total = 0;
  for (let rank = startRank; rank <= endRank; rank += 1) {
    total += getPointsForRank(rank, pointsTable);
  }
  return total;
}

// Weekly regular-season points from each player's over/under for the day.
function awardRegularSeasonPoints(players) {
  return awardRankedPoints(players, REGULAR_SEASON_POINTS, 'over_under');
}

// Breaks a tie using regular-season points, then the putt-off winner.
// Returns { winner, decidedBy, candidates }; winner is null if the putt-off
// is still needed (candidates are the players who must putt).
function breakTieByRegularPoints(tiedPlayers, puttoffWinnerId = null) {
  const maxRegular = Math.max(...tiedPlayers.map((player) => numericValue(player.regular_points)));
  const leaders = tiedPlayers.filter((player) => numericValue(player.regular_points) === maxRegular);

  if (leaders.length === 1) {
    return { winner: leaders[0], decidedBy: 'regular_points', candidates: leaders };
  }

  const puttoffWinner = leaders.find((player) => Number(player.player_id) === Number(puttoffWinnerId));
  if (puttoffWinner) {
    return { winner: puttoffWinner, decidedBy: 'puttoff', candidates: leaders };
  }

  return { winner: null, decidedBy: null, candidates: leaders };
}

// Semifinal week.
//   regularStandings: [{ player_id, name, regular_points }] for the season
//   participants:     [{ player_id, name }] on the tournament roster
//   scores:           [{ player_id, name, over_under }] for players who scored
//   overrideIds:      admin-chosen semifinal field (optional)
// Returns { error, missing, extra } when the roster is wrong, otherwise the
// seed/performance awards (with running totals), the finalists and the
// losers bracket awards.
function computeSemifinal({ regularStandings = [], participants = [], scores = [], overrideIds = [] }) {
  const regularById = new Map(regularStandings.map((row) => [Number(row.player_id), row]));
  const participantById = new Map(participants.map((row) => [Number(row.player_id), row]));
  const override = [...new Set(overrideIds.map(Number).filter(Number.isInteger))];

  const seeded = (override.length > 0
    ? override.map((playerId) => ({
      player_id: playerId,
      name: regularById.get(playerId)?.name || participantById.get(playerId)?.name || `Player ${playerId}`,
      regular_points: numericValue(regularById.get(playerId)?.regular_points)
    }))
    : selectTopWithTies(regularStandings, SEMIFINAL_FIELD_SIZE, 'regular_points').map((row) => ({
      player_id: Number(row.player_id),
      name: row.name,
      regular_points: numericValue(row.regular_points)
    })));
  const seededIds = new Set(seeded.map((row) => row.player_id));

  // With an override the admin's list is authoritative and extra players on
  // the roster are allowed (they play in the losers bracket).
  const missing = seeded.filter((row) => !participantById.has(row.player_id));
  const extra = override.length > 0
    ? []
    : participants.filter((row) => !seededIds.has(Number(row.player_id)));
  if (missing.length > 0 || extra.length > 0) {
    return { error: 'roster_mismatch', missing, extra };
  }

  const semifinalScores = scores.filter((row) => seededIds.has(Number(row.player_id)));
  if (semifinalScores.length === 0) {
    return { error: 'no_scores', missing: [], extra: [] };
  }

  const totals = new Map();
  const withRunningTotal = (award, resultType) => {
    const playerId = Number(award.player_id);
    const total = (totals.get(playerId) || 0) + numericValue(award.points_awarded);
    totals.set(playerId, total);
    return { ...award, player_id: playerId, result_type: resultType, cumulative_points_after: total };
  };

  const seedAwards = awardRankedPoints(seeded, PLAYOFF_SEED_POINTS, 'regular_points')
    .map((award) => withRunningTotal(award, 'seed'));
  const performanceAwards = awardRankedPoints(semifinalScores, PLAYOFF_SEED_POINTS, 'over_under')
    .map((award) => withRunningTotal(award, 'performance'));

  const semifinalTotals = semifinalScores.map((player) => ({
    player_id: Number(player.player_id),
    name: player.name,
    over_under: numericValue(player.over_under),
    regular_points: numericValue(regularById.get(Number(player.player_id))?.regular_points),
    playoff_points: totals.get(Number(player.player_id)) || 0
  }));
  const finalists = selectTopWithTies(semifinalTotals, FINAL_FIELD_SIZE, 'playoff_points');
  const finalistIds = new Set(finalists.map((row) => row.player_id));

  const losersBracketScores = scores.filter((row) => (
    participantById.has(Number(row.player_id)) && !finalistIds.has(Number(row.player_id))
  ));
  const losersAwards = awardRankedPoints(losersBracketScores, LOSERS_BRACKET_POINTS, 'over_under');

  return { error: null, seeded, seedAwards, performanceAwards, finalists, losersAwards };
}

// Final-round performance points for the finalists.
//   finalists: [{ player_id, name, over_under, regular_points }]
// Ties share points, except a tie for 1st: that is decided by regular-season
// points, then the putt-off. If the putt-off is still needed, the tied
// players share for now and firstPlaceTie.resolved is false.
function awardFinalRoundPoints(finalists = [], puttoffWinnerId = null) {
  if (finalists.length === 0) {
    return { awards: [], firstPlaceTie: null };
  }

  const sorted = sortByScore(finalists, 'over_under');
  const topScore = numericValue(sorted[0].over_under);
  const tiedForFirst = sorted.filter((player) => numericValue(player.over_under) === topScore);

  if (tiedForFirst.length === 1) {
    return { awards: awardRankedPoints(finalists, PLAYOFF_FINAL_POINTS, 'over_under'), firstPlaceTie: null };
  }

  const tiebreak = breakTieByRegularPoints(tiedForFirst, puttoffWinnerId);
  if (!tiebreak.winner) {
    return {
      awards: awardRankedPoints(finalists, PLAYOFF_FINAL_POINTS, 'over_under'),
      firstPlaceTie: { resolved: false, decidedBy: null, winner_id: null, candidates: tiebreak.candidates }
    };
  }

  const winnerId = Number(tiebreak.winner.player_id);
  const others = finalists.filter((player) => Number(player.player_id) !== winnerId);
  const awards = [
    {
      ...tiebreak.winner,
      rank_position: 1,
      tie_group_size: 1,
      points_awarded: getPointsForRank(1, PLAYOFF_FINAL_POINTS),
      score_value: topScore
    },
    ...awardRankedPoints(others, PLAYOFF_FINAL_POINTS, 'over_under', 2)
  ];

  return {
    awards,
    firstPlaceTie: { resolved: true, decidedBy: tiebreak.decidedBy, winner_id: winnerId, candidates: tiebreak.candidates }
  };
}

// Champion among the finalists.
//   finalists: [{ player_id, name, playoff_points, regular_points }]
//   playoff_points = seed + semifinal performance + final performance.
function pickChampion(finalists = [], puttoffWinnerId = null) {
  if (finalists.length === 0) {
    return { championId: null, decidedBy: null, needsTiebreak: false, candidates: [] };
  }

  const topPoints = Math.max(...finalists.map((player) => numericValue(player.playoff_points)));
  const tied = finalists.filter((player) => numericValue(player.playoff_points) === topPoints);

  if (tied.length === 1) {
    return { championId: Number(tied[0].player_id), decidedBy: 'playoff_points', needsTiebreak: false, candidates: tied };
  }

  const tiebreak = breakTieByRegularPoints(tied, puttoffWinnerId);
  return {
    championId: tiebreak.winner ? Number(tiebreak.winner.player_id) : null,
    decidedBy: tiebreak.decidedBy,
    needsTiebreak: !tiebreak.winner,
    candidates: tiebreak.candidates
  };
}

module.exports = {
  PLAYOFF_STAGE,
  REGULAR_SEASON_POINTS,
  PLAYOFF_SEED_POINTS,
  PLAYOFF_FINAL_POINTS,
  LOSERS_BRACKET_POINTS,
  SEMIFINAL_FIELD_SIZE,
  FINAL_FIELD_SIZE,
  getPointsForRank,
  sortByScore,
  selectTopWithTies,
  awardRankedPoints,
  sumPoints,
  awardRegularSeasonPoints,
  breakTieByRegularPoints,
  computeSemifinal,
  awardFinalRoundPoints,
  pickChampion
};
