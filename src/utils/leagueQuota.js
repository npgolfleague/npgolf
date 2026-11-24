// Quotas for 9- and 18-hole rounds.
//
// A player has one history of their last 7 rounds (the quota table). Each round
// is kept as played, and counts toward both quotas:
//   9-hole value:  the points of a 9-hole round, or half of an 18-hole round
//                  (rounded down)
//   18-hole value: the points of an 18-hole round, or double a 9-hole round
// Each quota is the average of its 7 values, rounded down. Both are stored on
// league_players whenever a round is completed. Only rounds in the same league
// count.
//
// This is the "last_7" method. A league picks its method in League Settings;
// to add another, build its calculation and mark it available here.
const QUOTA_METHODS = Object.freeze({
  last_7: { label: 'Use standard 7 round quota logic', available: true },
  best_8_of_20: { label: 'Use best 8 of last 20 quota logic', available: false }
});

const SLOTS = [1, 2, 3, 4, 5, 6, 7];
const isSet = (value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value));

// The rounds in a history row as { points, holes, nine, eighteen }, newest first.
// Old entries with no length recorded are taken to be 9 holes, unless every
// round with a length is 18.
const historyRounds = (row) => {
  const lengths = SLOTS.map((i) => Number(row?.[`holes_${i}`])).filter((h) => h === 9 || h === 18);
  const assumed = lengths.length > 0 && lengths.every((h) => h === 18) ? 18 : 9;
  return SLOTS.filter((i) => isSet(row?.[`points_${i}`])).map((i) => {
    const points = Number(row[`points_${i}`]);
    const recorded = Number(row[`holes_${i}`]);
    const holes = recorded === 9 || recorded === 18 ? recorded : assumed;
    return {
      points,
      holes,
      nine: holes === 18 ? Math.floor(points / 2) : points,
      eighteen: holes === 18 ? points : points * 2
    };
  });
};

const average = (values) => (
  values.length === 0 ? null : Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length)
);

// Both quotas from a history row; null when there are no rounds.
const quotasFromHistory = (row) => {
  const rounds = historyRounds(row);
  return { quota_9: average(rounds.map((r) => r.nine)), quota_18: average(rounds.map((r) => r.eighteen)) };
};

const recentAverageQuota = (row, holes) => quotasFromHistory(row)[Number(holes) === 9 ? 'quota_9' : 'quota_18'];

// The stored quota for a round. When only the other length is stored it is
// doubled or halved the same way.
const quotaForHoles = (player, holes) => {
  const nine = isSet(player?.quota_9) ? Number(player.quota_9) : null;
  const eighteen = isSet(player?.quota_18) ? Number(player.quota_18) : null;
  if (Number(holes) === 9) return nine ?? (eighteen === null ? null : Math.floor(eighteen / 2));
  return eighteen ?? (nine === null ? null : nine * 2);
};

// The same rule in SQL. `alias` is the league_players alias, always a constant.
const quotaSql = (holes, alias = 'lp') => (
  Number(holes) === 9
    ? `COALESCE(${alias}.quota_9, FLOOR(${alias}.quota_18 / 2))`
    : `COALESCE(${alias}.quota_18, ${alias}.quota_9 * 2)`
);

module.exports = { QUOTA_METHODS, historyRounds, quotasFromHistory, recentAverageQuota, quotaForHoles, quotaSql };
