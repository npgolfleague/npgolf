// Saving completed rounds in src/utils/quotaHistory.js.
const { applyRound, saveRound, slotsOf } = require('../src/utils/quotaHistory');

const round = (date, points) => ({ date, points, quota_diff: 0, holes: 9 });
const A = round('2026-08-19', 8);
const B = round('2026-08-26', 10);

test('a new round goes first and the oldest drops off', () => {
  const full = Array.from({ length: 7 }, (_u, i) => round(`2026-07-0${7 - i}`, i));
  const after = applyRound(full, B, null, B.date, 7);
  expect(after).toHaveLength(7);
  expect(after[0]).toBe(B);
  expect(after[6]).toBe(full[5]);
});

test('completing again replaces the entry, even with later rounds on top', () => {
  const fixed = round('2026-08-19', 12);
  expect(applyRound([B, A], fixed, 8, '2026-08-19', 7)).toEqual([B, fixed]);
});

test('a zero the first time still counts as an earlier completion', () => {
  const zero = round('2026-08-19', 0);
  expect(applyRound([zero], A, 0, '2026-08-19', 7)).toEqual([A]);
});

test('two rounds on one day are told apart by their points', () => {
  const morning = round('2026-08-26', 5);
  expect(applyRound([B, morning], round('2026-08-26', 6), 5, '2026-08-26', 7)[0]).toBe(B);
});

test('a player whose scores were removed loses the entry', () => {
  expect(applyRound([B, A], null, 10, '2026-08-26', 7)).toEqual([A]);
});

test('a round that already dropped off the history is not added back', () => {
  expect(applyRound([B], A, 8, '2026-08-19', 7)).toEqual([B]);
});

test('dates match whether the database gives a Date or text', () => {
  expect(applyRound([{ ...A, date: new Date(2026, 7, 19) }], B, 8, '2026-08-19', 7)).toEqual([B]);
});

test('saving writes every slot and returns the history', async () => {
  const query = jest.fn().mockResolvedValueOnce([[{ date_1: '2026-08-19', points_1: 8, quota_diff_1: 0, holes_1: 9 }]]).mockResolvedValueOnce([{}]);
  const row = await saveRound({ query }, 'quota', { playerId: 4, leagueId: 1, round: B, date: B.date });
  expect(row).toMatchObject({ points_1: 10, points_2: 8, points_3: null });
  expect(query.mock.calls[1][0]).toMatch(/^UPDATE quota SET date_1 = \?/);
  expect(query.mock.calls[1][1]).toHaveLength(30);
  expect(slotsOf(row, 7)).toHaveLength(2);
});
