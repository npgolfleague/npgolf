// Security headers, request size limits and error answers.
const request = require('supertest');

let mockUser = { id: 1, role: 'super_admin' };
jest.mock('../src/middleware/admin', () => {
  const actual = jest.requireActual('../src/middleware/admin');
  const pass = (req, res, next) => {
    if (!mockUser) return res.status(401).json({ error: 'Please log in to continue' });
    req.user = mockUser;
    return next();
  };
  return { ...actual, requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass, assertTournamentAccess: async () => {} };
});
jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (_req, _res, next) => next() }));
jest.mock('../src/db', () => ({ query: jest.fn(async () => [[]]), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const app = require('../src/server');

const conn = { query: jest.fn(async () => [{ insertId: 1 }]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
beforeEach(() => {
  mockUser = { id: 1, role: 'super_admin' };
  pool.getConnection.mockResolvedValue(conn);
});

test('every answer carries the security headers', async () => {
  for (const url of ['/api/version', '/api/nope', '/public/privacy']) {
    const { headers } = await request(app).get(url);
    expect(headers['content-security-policy']).toMatch(/script-src 'self'(;|$)/);
    expect(headers['strict-transport-security']).toBeDefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-powered-by']).toBeUndefined();
  }
});

test('only allowed sites get cross-origin credentials', async () => {
  const bad = await request(app).get('/api/version').set('Origin', 'https://evil.example');
  expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  expect(bad.headers['access-control-allow-credentials']).toBeUndefined();
});

const big = 'x'.repeat(2 * 1024 * 1024);

test('a large request without a login is refused', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: big, password: 'x' });
  expect(res.status).toBe(413);
  expect(res.body).toEqual({ error: 'That is too large to send' });
  mockUser = null;
  const scores = await request(app).post('/api/scores').send({ scores: [], pad: big });
  expect(scores.status).toBe(401);
});

test('a signed-in player can send scores with a large photo', async () => {
  const res = await request(app).post('/api/scores').send({
    scores: [{ tournament_id: 1, player_id: 1, hole_id: 1, score: 4, foursome_group: 'A', ctp_image_url: `data:image/jpeg;base64,${'x'.repeat(8 * 1024 * 1024)}` }]
  });
  expect(res.status).toBe(201);
});

test('malformed requests get a short answer with no internal details', async () => {
  const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: 'Invalid request' });
  expect(res.text).not.toMatch(/node_modules|at /);
});

test('an oversized attachment is refused', async () => {
  const res = await request(app).post('/api/emails/send').field('subject', 's').attach('attachment', Buffer.alloc(11 * 1024 * 1024), 'a.bin');
  expect(res.status).toBe(413);
});
