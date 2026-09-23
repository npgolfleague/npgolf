const PLAYOFF_STAGE = Object.freeze({
  REGULAR: 'regular',
  SEMIFINAL: 'semifinal',
  FINAL: 'final'
});

const PLAYOFF_SEED_POINTS = Object.freeze([100, 90, 80, 70, 60, 50, 40, 30]);
const PLAYOFF_FINAL_POINTS = Object.freeze([200, 90, 80, 70, 60, 50, 40, 30]);
const LOSERS_BRACKET_POINTS = Object.freeze([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]);

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

function awardRankedPoints(rows, pointsTable, scoreKey = 'over_under') {
  const sorted = sortByScore(rows, scoreKey);
  const awards = [];

  let index = 0;
  while (index < sorted.length) {
    const currentScore = numericValue(sorted[index]?.[scoreKey]);
    let nextIndex = index + 1;

    while (nextIndex < sorted.length && numericValue(sorted[nextIndex]?.[scoreKey]) === currentScore) {
      nextIndex += 1;
    }

    const startRank = index + 1;
    const endRank = nextIndex;
    const tieGroupSize = endRank - startRank + 1;
    const totalPoints = Array.from({ length: tieGroupSize }, (_unused, offset) => (
      getPointsForRank(startRank + offset, pointsTable)
    )).reduce((sum, value) => sum + value, 0);
    const averagePoints = totalPoints / tieGroupSize;

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

module.exports = {
  PLAYOFF_STAGE,
  PLAYOFF_SEED_POINTS,
  PLAYOFF_FINAL_POINTS,
  LOSERS_BRACKET_POINTS,
  getPointsForRank,
  sortByScore,
  selectTopWithTies,
  awardRankedPoints,
  sumPoints
};
