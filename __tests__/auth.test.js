// Checks that protected API routes reject anonymous and non-admin users.
// Uses the real auth middleware with a mocked database.
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => {
    req.league = { id: 1, name: 'Test League', billing_entity_id: 1 };
    next();
  }
}));

const ROLES = { 1: 'super_admin', 2: 'player' };

jest.mock('../src/db', () => ({
  query: jest.fn(async (sql, params) => {
    const normalized = (sql || '').toString().toLowerCase();
    if (normalized.startsWith('select id, name, email, role from players where id = ?')) {
      const id = Number(params[0]);
      return ROLES[id] ? [[{ id, name: `User ${id}`, email: `u${id}@example.com`, role: ROLES[id] }], []] : [[], []];
    }
    return [[], []];
  }),
  execute: jest.fn(async () => [{ insertId: 1 }, undefined]),
  getConnection: jest.fn()
}));

const app = require('../src/server');

const tokenFor = (id) => `Bearer ${jwt.sign({ sub: id }, process.env.JWT_SECRET)}`;

const adminOnly = [
  ['post', '/api/tournaments'],
  ['put', '/api/tournaments/1'],
  ['delete', '/api/tournaments/1'],
  ['post', '/api/tournaments/1/complete'],
  ['post', '/api/tournaments/1/send-sms'],
  ['post', '/api/tournaments/1/players'],
  ['put', '/api/tournaments/1/players/2/paid'],
  ['post', '/api/players/2/send-sms'],
  ['put', '/api/players/2/quota'],
  ['get', '/api/emails'],
  ['post', '/api/emails/send'],
  ['delete', '/api/emails/1'],
  ['post', '/api/cart-tags/tournament/1/send'],
  ['post', '/api/courses'],
  ['delete', '/api/courses/1'],
  ['post', '/api/courses/parse-scorecard'],
  ['delete', '/api/scores/1']
];

const loginOnly = [
  ['get', '/api/players'],
  ['get', '/api/players/2/quota'],
  ['get', '/api/tournaments/1/players'],
  ['post', '/api/scores']
];

describe('route protection', () => {
  test.each([...adminOnly, ...loginOnly])('%s %s rejects anonymous requests', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });

  test.each(adminOnly)('%s %s rejects a regular player', async (method, url) => {
    const res = await request(app)[method](url).set('Authorization', tokenFor(2)).send({});
    expect(res.status).toBe(403);
  });

  test('rejects a token signed with the wrong secret', async () => {
    const forged = `Bearer ${jwt.sign({ sub: 1 }, 'wrong-secret')}`;
    const res = await request(app).post('/api/tournaments').set('Authorization', forged).send({});
    expect(res.status).toBe(401);
  });

  test('lets an admin through to the handler', async () => {
    const res = await request(app).delete('/api/emails/1').set('Authorization', tokenFor(1));
    expect(res.status).toBe(200);
  });

  test('public routes stay public', async () => {
    const res = await request(app).get('/api/rules');
    expect([401, 403]).not.toContain(res.status);
  });
});
