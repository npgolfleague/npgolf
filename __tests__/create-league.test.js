// Creating a league saves it with a cup name, its alias and default settings.
const request = require('supertest');
jest.mock('../src/middleware/admin', () => {
  const pass = (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); };
  return { requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass,
    assertLeagueAdmin: async () => {}, assertTournamentAccess: async () => {}, AuthError: class extends Error {},
    isAdminCapableRole: () => true, isSuperAdminRole: () => true };
});
jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (_req, _res, next) => next() }));
jest.mock('../src/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));
const pool = require('../src/db');
const app = require('../src/server');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  pool.query.mockReset();
  pool.query.mockImplementation(async (sql) => {
    if (/FROM billing_entities/.test(sql)) return [[{ id: 1 }]];
    if (/slug = \?/.test(sql)) return [[]];
    if (/INSERT INTO leagues/.test(sql)) return [{ insertId: 9 }];
    return [[{ id: 9, name: 'New' }]];
  });
});
const insert = () => {
  const [sql, values] = pool.query.mock.calls.find(([s]) => /INSERT INTO leagues/.test(s));
  const names = sql.match(/leagues \(([^)]*)\)/)[1].split(',').map((n) => n.trim());
  return Object.fromEntries(names.map((n, i) => [n, values[i]]));
};
const body = { billing_entity_id: 1, name: 'New', slug: 'newleague', season_year: 2027 };

test.each([
  ['Desert Cup', 'Desert Cup'], ['  ', 'Paradise Cup'], [undefined, 'Paradise Cup']
])('cup name %j is saved as %j', async (sent, saved) => {
  const res = await request(app).post('/api/leagues').send({ ...body, cup_name: sent });
  expect(res.status).toBe(201);
  expect(insert()).toMatchObject({ name: 'New', slug: 'newleague', alias: 'newleague', cup_name: saved, season_year: 2027 });
  expect(pool.query.mock.calls.some(([s]) => /INSERT INTO league_settings/.test(s))).toBe(true);
});
