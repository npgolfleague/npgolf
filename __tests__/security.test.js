// Regression tests for the security review (November 2026).
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
const { optInLink, rsvpLink, confirmLink } = require('../src/utils/signedLinks');

let mockActor = { id: 2, role: 'league_admin' };
jest.mock('../src/middleware/admin', () => {
  const actual = jest.requireActual('../src/middleware/admin');
  const pass = (req, _res, next) => { req.user = mockActor; next(); };
  return { ...actual, requireAdmin: pass, requireSuperAdmin: pass, requireAnyAdmin: pass, requireAuth: pass };
});
jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => { req.league = { id: 1, name: 'L', billing_entity_id: 1 }; next(); }
}));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { escapeHtml } = require('../src/utils/html');
const app = require('../src/server');

const EVIL = '<script>alert(1)</script>';

beforeEach(() => {
  pool.query.mockReset();
  pool.execute.mockReset();
  mockActor = { id: 2, role: 'league_admin' };
  delete process.env.INBOUND_EMAIL_SECRET;
});

test('escapeHtml escapes markup and quotes', () => {
  expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  expect(escapeHtml(null)).toBe('');
});

test('league player list never selects every player column', async () => {
  pool.query.mockResolvedValue([[]]);
  await request(app).get('/api/leagues/1/players').expect(200);
  const sql = pool.query.mock.calls.map((c) => c[0]).join('\n');
  expect(sql).not.toMatch(/p\.\*|password|token/);
});

describe('inbound email webhook', () => {
  const send = () => request(app).post('/api/emails/inbound').type('form').send({ from: 'a@example.test', html: EVIL });

  test('is off without a configured secret', async () => {
    await send().expect(404);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects a wrong secret and accepts the right one', async () => {
    process.env.INBOUND_EMAIL_SECRET = 'right';
    pool.query.mockResolvedValue([{}]);
    await send().expect(403);
    await send().set('x-inbound-secret', 'wrong').expect(403);
    expect(pool.query).not.toHaveBeenCalled();
    await send().set('x-inbound-secret', 'right').expect(200);
  });
});

const pathOf = (link) => { const u = new URL(link); return u.pathname + u.search; };

test.each([optInLink('sms', 9), optInLink('email', 9), rsvpLink(3, 9),
  confirmLink(3, 9, 'yes'), confirmLink(3, 9, 'no')].map(pathOf))('%s escapes names', async (url) => {
  pool.execute.mockResolvedValue([{}]);
  pool.query.mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT ls.status')) return [[{ status: 'open', is_completed: 0 }]];
    if (sql.includes('FROM tournament t')) return [[{ id: 3, date: '2027-03-17', course_name: EVIL }]];
    if (sql.includes('FROM players')) return [[{ id: 9, name: EVIL, sms_allowed: 0, email_allowed: 0 }]];
    return [[]];
  });
  const res = await request(app).get(url);
  expect(res.status).toBe(200);
  expect(res.text).not.toContain('<script');
  expect(res.text).toContain('&lt;script&gt;');
  expect(res.headers['content-security-policy']).toContain("default-src 'none'");
});

describe('league admins cannot take over admin accounts', () => {
  const target = (role) => pool.query.mockImplementation(async () => [[{ id: 5, role, email: 'old@example.test' }]]);

  test.each(['admin', 'super_admin'])('cannot edit a %s', async (role) => {
    target(role);
    await request(app).put('/api/players/5').send({ name: 'X' }).expect(403);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test.each(['admin', 'super_admin'])('cannot delete a %s', async (role) => {
    const conn = { query: async () => [[{ id: 5, role }]], execute: jest.fn(), beginTransaction: jest.fn(), rollback: jest.fn(), release: jest.fn() };
    pool.getConnection.mockResolvedValue(conn);
    await request(app).delete('/api/players/5').expect(403);
    expect(conn.execute).not.toHaveBeenCalled();
  });

  test("cannot change another league admin's email", async () => {
    target('league_admin');
    await request(app).put('/api/players/5').send({ email: 'new@example.test' }).expect(403);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('can still edit a player', async () => {
    target('player');
    pool.execute.mockResolvedValue([{}]);
    await request(app).put('/api/players/5').send({ email: 'new@example.test' });
    expect(pool.execute).toHaveBeenCalled();
  });
});
