// Password rules, reuse on reset, and stronger hashing.
const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test-secret';
process.env.BCRYPT_ROUNDS = '5';

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => { req.league = { id: 1, billing_entity_id: 1 }; next(); }
}));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { passwordProblem, hashPassword } = require('../src/utils/passwords');
const { resetAuthLimits } = require('../src/routes/auth');
const app = require('../src/server');

const CURRENT = 'teal7Walnut';
let user;

beforeEach(() => {
  resetAuthLimits();
  user = { id: 9, name: 'Sam Sparks', email: 'bigdriver@example.test', active: 1, role: 'player', password: bcrypt.hashSync(CURRENT, 5) };
  pool.query.mockReset().mockImplementation(async (sql) => {
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }];
    if (sql.includes('FROM players')) return [[{ ...user }]];
    return [[]];
  });
});

test.each(['teal7Walnut', 'correct horse 9 battery', 'Bunker-Mower-42', 'my dog ate 3 shoes', 'Zürich7Laterne', 'xK9#vbQ2pLmT', 'fourputt9again'])('%s is allowed', (pw) => {
  expect(passwordProblem(pw, { name: 'Sam Sparks', email: 'bigdriver@example.test' })).toBeNull();
});

test.each([
  ['short', 'teal7Wal'], ['no number', 'tealWalnutTree'], ['no letter', '1938475620'], ['over 72 bytes', `a1${'b7Qx'.repeat(20)}`],
  ['common', 'Password123'], ['common with symbols', 'Password2026!'], ['swapped letters', 'P4ssw0rd123'], ['golf', 'Golf123456'],
  ['league', 'ParadiseGolf1'], ['site', 'npgolf2026!'], ['doubled', 'golfgolf12'], ['welcome', 'Welcome2026'],
  ['keyboard', 'qwertyuiop1'], ['alphabet', 'abcdefghij1'], ['backwards', '0987654321a'], ['repeated', 'aaaaaaaaa1'], ['two characters', 'a1a1a1a1a1'],
  ['name', 'sparks4ever99'], ['email', 'BigDriver77x'], ['not text', { a: 1 }]
])('%s is refused', (_label, pw) => {
  expect(passwordProblem(pw, { name: 'Sam Sparks', email: 'bigdriver@example.test' })).toEqual(expect.any(String));
});

describe('reset', () => {
  const reset = (password) => request(app).post('/api/auth/reset-password').send({ token: 't', password });
  const changed = () => pool.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE players SET password'));

  test('refuses the current password and keeps the link usable', async () => {
    const res = await reset(CURRENT).expect(400);
    expect(res.body.error).toMatch(/different from your current/);
    expect(changed()).toBe(false);
    await reset('brisk9Lantern').expect(200);
    expect(changed()).toBe(true);
  });

  test('refuses an easy password or one with the player\'s name', async () => {
    await reset('Password123').expect(400);
    await reset('sparks4ever99').expect(400);
    expect(changed()).toBe(false);
  });

  test('an unknown link learns nothing about passwords', async () => {
    pool.query.mockImplementation(async () => [[]]);
    const res = await reset('short').expect(400);
    expect(res.body.error).toBe('invalid or expired reset token');
  });
});

describe('hash strength', () => {
  const login = () => request(app).post('/api/auth/login').send({ email: user.email, password: CURRENT });
  const rehash = () => pool.query.mock.calls.find(([sql]) => sql === 'UPDATE players SET password = ? WHERE id = ? AND password = ?');

  test('a weaker hash is upgraded at login, and the session works with it', async () => {
    const old = bcrypt.hashSync(CURRENT, 4);
    user.password = old;
    const res = await login().expect(200);
    const [, [stronger, id, was]] = rehash();
    expect([bcrypt.getRounds(stronger), id, was]).toEqual([5, 9, old]);
    user.password = stronger;
    const me = await request(app).get('/api/leagues/1/seasons').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).not.toBe(401);
  });

  test('an up-to-date hash is left alone', async () => {
    await login().expect(200);
    expect(rehash()).toBeUndefined();
  });

  test('outside tests the cost is at least 12', async () => {
    process.env.NODE_ENV = 'production';
    try { expect(bcrypt.getRounds(await hashPassword('teal7Walnut'))).toBe(12); } finally { process.env.NODE_ENV = 'test'; }
  });

  test('the same password never hashes the same twice', async () => {
    expect(await hashPassword(CURRENT)).not.toBe(await hashPassword(CURRENT));
  });
});
