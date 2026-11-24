// Signed invitation/opt-in links and the Twilio webhook.
const request = require('supertest');
const twilio = require('twilio');

process.env.JWT_SECRET = 'test-secret';
process.env.APP_BASE_URL = 'https://golf.example.test';

jest.mock('../src/middleware/league', () => ({ leagueAliasMiddleware: (_req, _res, next) => next() }));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { confirmLink, rsvpLink, optInLink } = require('../src/utils/signedLinks');
const app = require('../src/server');

const pathOf = (link) => { const u = new URL(link); return u.pathname + u.search; };
let round;

beforeEach(() => {
  round = { status: 'open', is_completed: 0 };
  delete process.env.TWILIO_AUTH_TOKEN;
  pool.execute.mockReset().mockResolvedValue([{}]);
  pool.query.mockReset().mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT ls.status')) return [[round]];
    if (sql.includes('FROM tournament t')) return [[{ id: 3, date: '2027-03-17', course_name: 'C' }]];
    if (sql.includes('FROM players')) return [[{ id: 9, name: 'Pat', phone: '+1', sms_allowed: 0, email_allowed: 0 }]];
    return [[]];
  });
});

const wrote = () => pool.execute.mock.calls.length > 0
  || pool.query.mock.calls.some(([sql]) => /^\s*(INSERT|UPDATE|DELETE)/.test(sql));

const LINKS = {
  'confirm yes': confirmLink(3, 9, 'yes'), 'confirm no': confirmLink(3, 9, 'no'), rsvp: rsvpLink(3, 9),
  'sms opt-in': optInLink('sms', 9), 'email opt-in': optInLink('email', 9)
};

test.each(Object.entries(LINKS))('%s link works', async (_n, link) => {
  expect(link.startsWith('https://golf.example.test/')).toBe(true);
  await request(app).get(pathOf(link)).expect(200);
  expect(wrote()).toBe(true);
});

const tampered = [
  ...Object.entries(LINKS).map(([n, l]) => [`${n} without a signature`, pathOf(l).replace(/[?&]sig=.*/, '')]),
  ...Object.entries(LINKS).map(([n, l]) => [`${n} with a changed signature`, `${pathOf(l)}x`]),
  ['another player', pathOf(LINKS['confirm yes']).replace('playerId=9', 'playerId=10')],
  ['another round', pathOf(LINKS.rsvp).replace('/3/', '/4/')],
  ['another answer', pathOf(LINKS['confirm yes']).replace('response=yes', 'response=no')],
  ['another player\'s opt-in', pathOf(LINKS['sms opt-in']).replace('/9/', '/10/')],
  ['an sms signature on email', pathOf(LINKS['sms opt-in']).replace('sms-opt-in', 'email-opt-in')],
  ['an extra player', `${pathOf(LINKS.rsvp)}&playerId=10`],
  ['two signatures', `${pathOf(LINKS.rsvp)}&sig=a`]
];
test.each(tampered)('%s is refused', async (_n, url) => {
  await request(app).get(url).expect(403);
  expect(wrote()).toBe(false);
});

test.each([{ status: 'closed', is_completed: 0 }, { status: 'open', is_completed: 1 }])('a finished round is refused: %p', async (state) => {
  round = state;
  await request(app).get(pathOf(LINKS.rsvp)).expect(409);
  await request(app).get(pathOf(LINKS['confirm no'])).expect(409);
  expect(wrote()).toBe(false);
});

describe('Twilio webhook', () => {
  const body = { From: '+18135550100', Body: 'STOP' };
  const post = (sig) => request(app).post('/api/players/sms-webhook').type('form').set('X-Twilio-Signature', sig).send(body);

  test('is off without an auth token', async () => {
    await post('x').expect(404);
    expect(wrote()).toBe(false);
  });

  test('accepts only Twilio-signed requests', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    await post('x').expect(403);
    expect(wrote()).toBe(false);
    const sig = twilio.getExpectedTwilioSignature('tok', 'https://golf.example.test/api/players/sms-webhook', body);
    await post(sig).expect(200);
    expect(wrote()).toBe(true);
  });
});
