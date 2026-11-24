// Contact details are for admins; accounts sharing an email all work.
const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret';
process.env.OUTGOING_EMAIL_DELAY_MS = '0';

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => { req.league = { id: 1, name: 'One', billing_entity_id: 1 }; next(); }
}));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));
jest.mock('../src/email', () => ({ sendEmail: jest.fn(async () => ({})) }));
jest.mock('../src/payouts', () => ({ rebuildLeaguePayouts: async () => 0, rebuildTournamentPayouts: async () => 0 }));

const pool = require('../src/db');
const { sendEmail } = require('../src/email');
const { signAccessToken } = require('../src/utils/authTokens');
const { resetAuthLimits } = require('../src/routes/auth');
const app = require('../src/server');

const ROLES = { 1: 'super_admin', 2: 'league_admin', 3: 'player' };
const as = (id) => `Bearer ${signAccessToken({ id, password: 'h' }, process.env.JWT_SECRET, '1h')}`;
const PEOPLE = [{ id: 3, name: 'Me', email: 'me@x.test', phone: '1' }, { id: 4, name: 'Pat', email: 'pat@x.test', phone: '2' }];
let shared;

beforeEach(() => {
  resetAuthLimits();
  sendEmail.mockClear();
  shared = [];
  pool.query.mockReset().mockImplementation(async (sql, params = []) => {
    if (sql.startsWith('SELECT id, name, email, role, active, password')) return [[{ id: params[0], role: ROLES[params[0]], active: 1, password: 'h' }]];
    if (sql.startsWith('SELECT 1 FROM league_players')) return [[{ 1: 1 }]];
    if (sql.startsWith('SELECT league_id FROM tournament')) return [[{ league_id: 1 }]];
    if (sql.includes('LOWER(p.email) = LOWER(?)')) return [shared];
    if (sql.startsWith('SELECT season_year FROM leagues')) return [[{ season_year: 2027 }]];
    if (sql.startsWith('SELECT * FROM league_seasons')) return [[{ id: 9 }]];
    if (sql.includes('FROM league_settings')) return [[{ league_id: 1, golf_course_email: 'pro@x.test', outgoing_email_from: 'o@x.test', live_scoring: 1 }]];
    if (sql.includes('FROM leagues l')) return [[{ id: 1, name: 'One', billing_email: 'b@x.test' }]];
    if (sql.includes('SELECT id FROM tournament')) return [[{ id: 10 }]];
    if (sql.includes('FROM players p') || sql.includes('JOIN players p')) return [PEOPLE.map((p) => ({ ...p }))];
    if (sql.includes('FROM tournament t')) return [[{ id: 10 }]];
    return [[]];
  });
});

const get = (url, id) => { const r = request(app).get(url); return id ? r.set('Authorization', as(id)) : r; };

test.each(['/api/players', '/api/leagues/1/players', '/api/tournaments/10/players'])('%s: players see only their own contact details', async (url) => {
  const mine = (await get(url, 3).expect(200)).body;
  expect(mine.find((p) => p.id === 3).email).toBe('me@x.test');
  expect(mine.find((p) => p.id === 4)).toEqual({ id: 4, name: 'Pat' });
  for (const admin of [1, 2]) expect((await get(url, admin).expect(200)).body.find((p) => p.id === 4).phone).toBe('2');
});

test('attendance hides contact details from players', async () => {
  expect(JSON.stringify((await get('/api/tournaments/10/attendance', 3).expect(200)).body)).not.toContain('pat@x.test');
  expect(JSON.stringify((await get('/api/tournaments/10/attendance', 2).expect(200)).body)).toContain('pat@x.test');
});

test.each(['/api/leagues', '/api/leagues/1', '/api/leagues/current', '/api/leagues/1/settings', '/api/settings'])('%s: emails only for admins', async (url) => {
  expect((await get(url).expect(200)).text).not.toContain('@x.test');
  expect((await get(url, 3).expect(200)).text).not.toContain('@x.test');
  expect((await get(url, 2).expect(200)).text).toContain('@x.test');
  expect((await get(url).set('Authorization', 'Bearer nonsense').expect(200)).text).not.toContain('@x.test');
});

test('the league finder is limited', async () => {
  const codes = [];
  for (let i = 0; i < 21; i += 1) codes.push((await get(`/api/league-select/by-email?email=a${i}@x.test`)).status);
  expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true);
  expect(codes[20]).toBe(429);
});

describe('accounts sharing an email', () => {
  const acc = (id, pw, active = 1) => ({ id, name: `N${id}`, email: 's@x.test', active, role: 'player', password: bcrypt.hashSync(pw, 4), leagues: `L${id}` });
  const login = (password) => request(app).post('/api/auth/login').send({ email: 's@x.test', password });

  test('the password decides which account signs in', async () => {
    shared = [acc(57, 'Firstpass1'), acc(15, 'Secondpw1')];
    expect((await login('Firstpass1').expect(200)).body.user.id).toBe(57);
    expect((await login('Secondpw1').expect(200)).body.user.id).toBe(15);
    await login('Neither11').expect(401);
  });

  test('an active account wins over a deactivated one with the same password', async () => {
    shared = [acc(15, 'Samepass1', 0), acc(57, 'Samepass1')];
    expect((await login('Samepass1').expect(200)).body.user.id).toBe(57);
    shared = [acc(15, 'Samepass1', 0)];
    await login('Samepass1').expect(403);
  });

  test('a reset email has one link per account, and is not copied to anyone', async () => {
    shared = [acc(10, 'x'), acc(56, 'x')];
    await request(app).post('/api/auth/forgot-password').send({ email: 's@x.test' }).expect(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, , html, text, , bcc] = sendEmail.mock.calls[0];
    expect(to).toBe('s@x.test');
    expect(bcc).toBe(false);
    expect(new Set(html.match(/token=[0-9a-f]{64}/g)).size).toBe(2);
    expect(text).toContain('N10 (L10)');
    expect(text).toContain('N56 (L56)');
  });
});
