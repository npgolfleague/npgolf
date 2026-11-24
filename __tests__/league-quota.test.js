// Quota rules in src/utils/leagueQuota.js.
const { historyRounds, quotasFromHistory, recentAverageQuota, quotaForHoles, quotaSql } = require('../src/utils/leagueQuota');

const history = (...rounds) => Object.fromEntries(rounds.flatMap(([points, holes], i) => [
  [`points_${i + 1}`, points], [`holes_${i + 1}`, holes]
]));

test('a 9-hole round counts as played, and doubled toward the 18-hole quota', () => {
  expect(historyRounds(history([11, 9]))[0]).toMatchObject({ nine: 11, eighteen: 22 });
});

test('an 18-hole round counts as played, and half rounded down toward the 9-hole quota', () => {
  expect(historyRounds(history([23, 18]))[0]).toMatchObject({ nine: 11, eighteen: 23 });
});

test('both quotas average the same rounds, rounded down', () => {
  // 9-hole: (8 + 11 + 9) / 3 = 9.33; 18-hole: (16 + 23 + 18) / 3 = 19
  expect(quotasFromHistory(history([8, 9], [23, 18], [9, 9]))).toEqual({ quota_9: 9, quota_18: 19 });
  // 9-hole: (7 + 8) / 2 = 7.5 -> 7; 18-hole: (14 + 16) / 2 = 15
  expect(quotasFromHistory(history([7, 9], [8, 9]))).toEqual({ quota_9: 7, quota_18: 15 });
});

test('only seven rounds exist, zero counts, empty slots do not', () => {
  expect(quotasFromHistory(history([0, 9], [4, 9], [null, null]))).toEqual({ quota_9: 2, quota_18: 4 });
  expect(quotasFromHistory({})).toEqual({ quota_9: null, quota_18: null });
  expect(quotasFromHistory(undefined)).toEqual({ quota_9: null, quota_18: null });
});

test('old entries without a length are 9 holes, unless the others are all 18', () => {
  expect(quotasFromHistory(history([8, 9], [10, null]))).toEqual({ quota_9: 9, quota_18: 18 });
  expect(quotasFromHistory(history([20, 18], [22, null]))).toEqual({ quota_9: 10, quota_18: 21 });
});

test('the recent average follows the length of the round', () => {
  expect(recentAverageQuota(history([9, 9], [20, 18]), 9)).toBe(9);
  expect(recentAverageQuota(history([9, 9], [20, 18]), 18)).toBe(19);
});

test('a stored quota is used as is; a missing one comes from the other length', () => {
  expect(quotaForHoles({ quota_9: 13, quota_18: 27 }, 18)).toBe(27);
  expect(quotaForHoles({ quota_9: 13, quota_18: null }, 18)).toBe(26);
  expect(quotaForHoles({ quota_9: null, quota_18: 19 }, 9)).toBe(9);
  expect(quotaForHoles({ quota_9: 0, quota_18: null }, 18)).toBe(0);
  expect(quotaForHoles({ quota_9: null, quota_18: null }, 18)).toBeNull();
  expect(quotaForHoles(undefined, 9)).toBeNull();
});

test('the SQL follows the same rule', () => {
  expect(quotaSql(9)).toBe('COALESCE(lp.quota_9, FLOOR(lp.quota_18 / 2))');
  expect(quotaSql(18, 'lpq')).toBe('COALESCE(lpq.quota_18, lpq.quota_9 * 2)');
});
