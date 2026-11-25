const { DEFAULT_POINTS_TABLES, pointsTablesError, resolvePointsTables } = require('../src/utils/pointsTables');
const { awardRegularSeasonPoints, computeSemifinal, awardFinalRoundPoints } = require('../src/utils/playoffs');
const people = (scores) => scores.map((s, i) => ({ player_id: i + 1, name: `P${i + 1}`, over_under: s, regular_points: 1000 - i }));
const pts = (awards) => awards.map((a) => a.points_awarded);

test('no setting means the standard values', () => {
  expect(resolvePointsTables(null)).toEqual(DEFAULT_POINTS_TABLES);
  expect(resolvePointsTables('not json')).toEqual(DEFAULT_POINTS_TABLES);
});

test('an own table replaces only that one, stored as text or object', () => {
  const own = { weekly: [50, 25, 0] };
  for (const stored of [own, JSON.stringify(own)]) {
    expect(resolvePointsTables(stored)).toEqual({ ...DEFAULT_POINTS_TABLES, weekly: [50, 25, 0] });
  }
});

test('an unusable stored table falls back', () => {
  expect(resolvePointsTables({ final: ['x'] }).final).toEqual(DEFAULT_POINTS_TABLES.final);
});

test.each([
  [null], [[1]], [{ other: [1] }], [{ toString: [1] }], [{ weekly: [] }], [{ weekly: [''] }], [{ weekly: ['5'] }],
  [{ weekly: [1.5] }], [{ weekly: [-1] }], [{ weekly: [10, 20] }], [{ weekly: Array(51).fill(1) }], [{ weekly: [10001] }]
])('refuses %j', (value) => expect(pointsTablesError(value)).toEqual(expect.any(String)));

test('accepts a good table', () => expect(pointsTablesError({ weekly: [10, 10, 0] })).toBeNull());

test('weekly: the last value covers the places below', () => {
  expect(pts(awardRegularSeasonPoints(people([5, 4, 3, 2]), [50, 25, 5]))).toEqual([50, 25, 5, 5]);
});

test('semifinal uses its own seed, round and losers tables', () => {
  const field = people([8, 7, 6, 5, 4, 3, 2, 1]);
  const r = computeSemifinal({ regularStandings: field, participants: field, scores: field,
    tables: { seed: [80, 10], semifinal: [40, 20], losers: [7, 3] } });
  expect(pts(r.seedAwards).slice(0, 3)).toEqual([80, 10, 10]);
  expect(pts(r.performanceAwards).slice(0, 3)).toEqual([40, 20, 20]);
  // 2nd through 8th tie on 30 points, so all reach the final
  expect(r.finalists).toHaveLength(8);
  const uneven = computeSemifinal({ regularStandings: field, participants: field, scores: field,
    tables: { seed: [8, 7, 6, 5, 4], semifinal: [8, 7, 6, 5, 4], losers: [7, 3] } });
  expect(pts(uneven.losersAwards)).toEqual([7, 3, 3, 3]);
});

test('final uses its own table, also when 1st is decided by tiebreak', () => {
  expect(pts(awardFinalRoundPoints(people([9, 8, 7]), null, [500, 50, 5]).awards)).toEqual([500, 50, 5]);
  expect(pts(awardFinalRoundPoints(people([9, 9, 7]), null, [500, 50, 5]).awards)).toEqual([500, 50, 5]);
});
