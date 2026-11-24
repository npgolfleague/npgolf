// Quota rules in src/utils/leagueQuota.js.
const { quotaForHoles, quotaSql, keepsNineHoleHistory } = require('../src/utils/leagueQuota');

test('18-hole quota doubles the nine-hole quota only when missing', () => {
  expect(quotaForHoles({ quota_9: 13, quota_18: null }, 18)).toBe(26);
  expect(quotaForHoles({ quota_9: 13, quota_18: 38 }, 18)).toBe(38);
  expect(quotaForHoles({ quota_9: 13, quota_18: 0 }, 18)).toBe(0);
  expect(quotaForHoles({ quota_9: 0, quota_18: null }, 18)).toBe(0);
  expect(quotaForHoles({ quota_9: null, quota_18: null }, 18)).toBeNull();
  expect(quotaForHoles(undefined, 18)).toBeNull();
});

test('nine-hole rounds never use the 18-hole quota', () => {
  expect(quotaForHoles({ quota_9: null, quota_18: 20 }, 9)).toBeNull();
  expect(quotaForHoles({ quota_9: 7, quota_18: 20 }, '9')).toBe(7);
});

test('the SQL follows the same rule', () => {
  expect(quotaSql(9)).toBe('lp.quota_9');
  expect(quotaSql(18, 'lpq')).toBe('COALESCE(lpq.quota_18, lpq.quota_9 * 2)');
});

test('an 18-hole round leaves a nine-hole history alone', () => {
  const nine = { holes_1: 9, holes_2: 9 };
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: null }, nine, 18)).toBe(true);
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: 18 }, nine, 18)).toBe(true);
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: null }, undefined, 18)).toBe(true);
});

test('other rounds still count', () => {
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: null }, { holes_1: 9 }, 9)).toBe(false);
  expect(keepsNineHoleHistory({ quota_9: null, quota_18: 20 }, { holes_1: 18 }, 18)).toBe(false);
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: 20 }, { holes_1: 9, holes_2: 18 }, 18)).toBe(false);
  expect(keepsNineHoleHistory({ quota_9: 8, quota_18: 20 }, undefined, 18)).toBe(false);
  expect(keepsNineHoleHistory(undefined, undefined, 18)).toBe(false);
});
