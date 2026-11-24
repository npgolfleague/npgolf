// Attempt limits, sign-up checks and session rules in src/routes/auth.js.
const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.OUTGOING_EMAIL_DELAY_MS = '0';

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => { req.league = { id: 1, name: 'L', billing_entity_id: 1 }; next(); }
}));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));
jest.mock('../src/email', () => ({ sendEmail: jest.fn(async () => ({})) }));

const pool = require('../src/db');
const { sendEmail } = require('../src/email');
const { Limiter, clientIp } = require('../src/middleware/rateLimit');
const { resetAuthLimits, isPlausibleName } = require('../src/routes/auth');
const app = require('../src/server');

const hash = bcrypt.hashSync('Passw0rd1', 4);
let user;

beforeEach(() => {
  resetAuthLimits();
  sendEmail.mockClear();
  user = { id: 9, name: 'Pat', email: 'pat@example.test', active: 1, role: 'player', password: hash };
  pool.query.mockReset();
  pool.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM leagues')) return [[{ id: 1, billing_entity_id: 1, active: 1 }]];
    if (sql.includes('INSERT INTO players')) return [{ insertId: 10 }];
    if (sql.includes('JOIN league_players lp ON lp.player_id = p.id\n       WHERE lp.league_id')) return [[]];
    if (sql.includes('FROM players')) return [[user]];
    return [{ affectedRows: 1 }];
  });
});

const login = (password, ip = '203.0.113.1', email = 'pat@example.test') => (
  request(app).post('/api/auth/login').set('CF-Connecting-IP', ip).send({ email, password }));

describe('login limits', () => {
  test('blocks an address after repeated failures, even with the right password', async () => {
    for (let i = 0; i < 8; i += 1) await login('wrong1234').expect(401);
    const res = await login('Passw0rd1');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('does not block someone else, and email case does not dodge the limit', async () => {
    for (let i = 0; i < 8; i += 1) await login('wrong1234', '203.0.113.1', i % 2 ? 'PAT@example.test' : 'pat@example.test');
    await login('Passw0rd1').expect(429);
    await login('Passw0rd1', '203.0.113.2').expect(200);
  });

  test('a successful login clears the count', async () => {
    for (let i = 0; i < 7; i += 1) await login('wrong1234');
    await login('Passw0rd1').expect(200);
    await login('wrong1234').expect(401);
  });

  test('many successful logins from one network are fine', async () => {
    for (let i = 0; i < 50; i += 1) await login('Passw0rd1').expect(200);
  });
});

describe('deactivated accounts', () => {
  test('cannot log in or refresh, and wrong passwords look the same as for anyone', async () => {
    user.active = 0;
    await login('Passw0rd1').expect(403);
    await login('wrong1234').expect(401);
    await request(app).post('/api/auth/refresh').send({ refreshToken: 'abc' }).expect(401);
  });
});

describe('sign-up checks', () => {
  const signUp = (over = {}) => request(app).post('/api/auth/register')
    .send({ name: 'Pat Smith', email: 'new@example.test', password: 'teal7Walnut', phone: '(813) 555-0100', league_id: 1, ...over });
  const inserted = () => pool.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO players'));

  test('accepts a normal player', async () => {
    await signUp().expect(201);
    expect(inserted()).toBe(true);
  });

  test.each([
    ['filled trap field', { website: 'http://x.test' }],
    ['link in name', { name: 'Bonus! https://ibit.ly/VMxlX' }],
    ['bare link in name', { name: 'go ibit.ly/VMxlX' }],
    ['markup in name', { name: '<b>Pat</b>' }],
    ['object as name', { name: { a: 1 } }],
    ['bad email', { email: 'nope' }],
    ['object as email', { email: { a: 1 } }],
    ['bad phone', { phone: 'call me' }]
  ])('refuses %s', async (_label, over) => {
    await signUp(over).expect(400);
    expect(inserted()).toBe(false);
  });

  test.each(["Sean O'Brien", 'José Núñez', 'J. R. Smith-Jones Jr.', 'Mary (Beth) Lee', 'RONALD I SPEARS'])('allows the name %s', (name) => {
    expect(isPlausibleName(name)).toBe(true);
  });

  test('limits sign-ups from one address', async () => {
    for (let i = 0; i < 15; i += 1) await signUp();
    await signUp().expect(429);
  });
});

describe('password reset', () => {
  test('sends at most three emails an hour per account, with the same answer', async () => {
    const answers = new Set();
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'pat@example.test' }).expect(200);
      answers.add(JSON.stringify(res.body));
    }
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(answers.size).toBe(1);
  });

  test('ends open sessions', async () => {
    await request(app).post('/api/auth/reset-password').send({ token: 't', password: 'Newpass123' }).expect(200);
    const update = pool.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE players SET password'));
    expect(update[0]).toMatch(/refresh_token_hash = NULL/);
  });
});

describe('limiter', () => {
  test('lets attempts through again after the window', () => {
    let t = 0;
    const l = new Limiter({ max: 2, windowMs: 1000, now: () => t });
    l.hit('a'); l.hit('a');
    expect(l.blockedFor('a')).toBe(1);
    t = 1001;
    expect(l.blockedFor('a')).toBe(0);
  });

  test('only believes CF-Connecting-IP from a private connection', () => {
    const req = (remoteAddress) => ({ socket: { remoteAddress }, get: () => '203.0.113.9' });
    expect(clientIp(req('::ffff:172.18.0.4'))).toBe('203.0.113.9');
    expect(clientIp(req('198.51.100.7'))).toBe('198.51.100.7');
  });
});
