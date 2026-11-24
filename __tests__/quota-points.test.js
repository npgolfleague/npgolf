// The server works out quota points and ignores what the device sends.
const request = require('supertest');

jest.mock('../src/middleware/admin', () => {
  const actual = jest.requireActual('../src/middleware/admin');
  const pass = (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); };
  return { ...actual, requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass, assertTournamentAccess: async () => {} };
});
jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (_req, _res, next) => next() }));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { pointsForScore, DEFAULT_TABLE } = require('../src/utils/quotaPoints');
const app = require('../src/server');

const FARLEY = { albatross: 6, eagle: 5, birdie: 3, par: 2, bogey: 1, double_bogey: 0, worse: 0 };
const conn = { query: jest.fn(async () => [{ insertId: 1 }]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
let par;
let table;

beforeEach(() => {
  par = 4;
  table = null;
  conn.query.mockClear();
  pool.getConnection.mockReset().mockResolvedValue(conn);
  pool.query.mockReset().mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT ht.par')) return [par === null ? [] : [{ par }]];
    if (sql.startsWith('SELECT ls.quota_points')) return [table ? [table] : []];
    if (sql.startsWith('SELECT tournament_id, player_id, hole_id')) return [[{ tournament_id: 1, player_id: 3, hole_id: 2 }]];
    return [[]];
  });
});

test.each([
  [1, 3, 8], [1, 4, 8], [2, 5, 8], [2, 4, 6], [3, 5, 6], [2, 3, 4], [3, 4, 4], [4, 4, 2], [5, 4, 1], [6, 4, 0], [7, 4, 0], [10, 3, 0]
])('a %i on a par %i is %i points by the rules', (score, p, points) => {
  expect(pointsForScore(score, p, DEFAULT_TABLE)).toBe(points);
});

const save = (over = {}) => request(app).post('/api/scores').send({
  scores: [{ tournament_id: 1, player_id: 3, hole_id: 2, score: 5, foursome_group: 'A', ...over }]
});
const savedQuota = () => conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO scores'))[1][4];

test.each([8, 99, null, undefined, 'x'])('points sent as %p are ignored', async (quota) => {
  const res = await save({ quota }).expect(201);
  expect(savedQuota()).toBe(1);
  expect(res.body.scores[0].quota).toBe(1);
});

test('uses the league\'s own table and the par for that player', async () => {
  table = FARLEY;
  await save({ score: 3, quota: 4 }).expect(201);
  expect(savedQuota()).toBe(3);
  conn.query.mockClear();
  par = 5;
  await save({ score: 5 }).expect(201);
  expect(savedQuota()).toBe(2);
});

test.each([0, -1, 31, 4.5, 'abc', null, undefined])('a score of %p is refused', async (score) => {
  await save({ score }).expect(400);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('a hole that is not in the round is refused', async () => {
  par = null;
  await save().expect(400);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('an admin correction also recalculates points', async () => {
  const res = await request(app).put('/api/scores/7').send({ score: 4, quota: 8 }).expect(200);
  expect(res.body.quota).toBe(2);
  const update = pool.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE scores SET score'));
  expect(update[1].slice(0, 2)).toEqual([4, 2]);
});

describe('league settings', () => {
  const put = (body) => {
    pool.query.mockImplementation(async (sql) => (sql.startsWith('SELECT id FROM leagues') ? [[{ id: 1 }]] : [[{}]]));
    return request(app).put('/api/leagues/1/settings').send(body);
  };
  const update = () => pool.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE league_settings'));

  test('only the settings sent are changed', async () => {
    await put({ live_scoring: false }).expect(200);
    expect(update()).toEqual(['UPDATE league_settings SET live_scoring = ? WHERE league_id = ?', [0, 1].map((v, i) => (i ? '1' : v))]);
  });

  test('the standard quota method is saved', async () => {
    await put({ quota_method: 'last_7' }).expect(200);
    expect(update()[1][0]).toBe('last_7');
  });

  test.each(['best_8_of_20', 'other', '', null, 'constructor'])('quota method %p is refused', async (quota_method) => {
    await put({ quota_method }).expect(400);
    expect(update()).toBeUndefined();
  });

  test('points, including zero, are saved as sent', async () => {
    await put({ quota_points_par: 2, quota_points_double_bogey: 0 }).expect(200);
    expect(update()[1].slice(0, 2)).toEqual([2, 0]);
  });

  test.each([[{ quota_points_par: -1 }], [{ quota_points_par: 1.5 }], [{ quota_points_par: 'x' }], [{ tournament_fee_9_holes: -5 }]])('%p is refused', async (body) => {
    await put(body).expect(400);
    expect(update()).toBeUndefined();
  });
});
