// A refused completion must leave nothing behind, and overrides must ignore seed rows.
const request = require('supertest');
jest.mock('../src/middleware/admin', () => {
  const pass = (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); };
  return { requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass,
    assertLeagueAdmin: async () => {}, assertTournamentAccess: async () => {}, AuthError: class extends Error {},
    isAdminCapableRole: () => true, isSuperAdminRole: () => true };
});
jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (req, _res, next) => { req.league = { id: 1 }; next(); } }));
jest.mock('../src/middleware/season', () => ({ ...jest.requireActual('../src/middleware/season'), requireOpenSeason: (_q, _s, next) => next() }));
jest.mock('../src/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));
const pool = require('../src/db');
const app = require('../src/server');

const connect = (answer) => {
  const c = { query: jest.fn(async (sql, p) => answer(sql, p) || [[]]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), destroy: jest.fn() };
  pool.getConnection.mockResolvedValue(c);
  return c;
};
beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

test('a semifinal with the wrong players is refused and undone', async () => {
  const c = connect((sql) => {
    if (/ls\.champion_tiebreak_player_id,/.test(sql)) return [[{ date: '2026-11-25', number_of_holes: 9, league_id: 1, season_id: 1, playoff_stage: 'semifinal' }]];
    if (/playoff_format\s+FROM league_settings/.test(sql)) return [[{ playoff_format: 'fedex_cup' }]];
    if (/score_count/.test(sql)) return [[{ score_count: 9 }]];
    if (/COALESCE\(tp\.tournament_quota/.test(sql)) return [[{ player_id: 5, name: 'Extra', current_quota: 8, total_points: 9 }]];
    if (/INSERT INTO/.test(sql)) return [{ insertId: 1 }];
    if (/SELECT tp\.player_id, p\.name\s+FROM tournament_players/.test(sql)) return [[{ player_id: 5, name: 'Extra' }]];
    return null;
  });
  const res = await request(app).post('/api/tournaments/30/complete');
  expect(res.status).toBe(400);
  expect(res.body.extra_participants).toEqual([{ player_id: 5, name: 'Extra' }]);
  expect(c.beginTransaction).toHaveBeenCalled();
  expect(c.commit).not.toHaveBeenCalled();
  expect(c.rollback).toHaveBeenCalled();
  expect(c.rollback.mock.invocationCallOrder[0]).toBeLessThan(c.release.mock.invocationCallOrder[0]);
});

test('points override saves performance rows and leaves seed rows alone', async () => {
  const c = connect((sql) => (/SELECT t\.season_id/.test(sql) ? [[{ season_id: 1 }]] : null));
  const res = await request(app).post('/api/tournaments/30/playoff/points').send({ bracket_type: 'playoff', playoff_week: 1,
    points: [{ player_id: 5, result_type: 'seed', points_awarded: 100 }, { player_id: 5, result_type: 'performance', points_awarded: 90 }] });
  expect(res.status).toBe(200);
  expect(c.query.mock.calls.filter(([sql]) => /INSERT INTO tournament_playoff_points/.test(sql))).toHaveLength(1);
});

test('points override refuses a player listed twice', async () => {
  const c = connect((sql) => (/SELECT t\.season_id/.test(sql) ? [[{ season_id: 1 }]] : null));
  const res = await request(app).post('/api/tournaments/30/playoff/points').send({ bracket_type: 'playoff', playoff_week: 1,
    points: [{ player_id: 5, points_awarded: 1 }, { player_id: 5, points_awarded: 2 }] });
  expect(res.status).toBe(400);
  expect(c.beginTransaction).not.toHaveBeenCalled();
});
