const request = require('supertest');

process.env.GIT_COMMIT = 'abc1234';
process.env.GIT_BRANCH = 'main';
process.env.BUILD_TIME = '2026-11-06T20:00:00Z';

jest.mock('../src/db', () => ({ query: jest.fn(async () => [[], []]) }));

const app = require('../src/server');
const { version } = require('../package.json');

test('GET /api/version reports the build stamped into the image, without login', async () => {
  const res = await request(app).get('/api/version');
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body).toMatchObject({
    version,
    commit: 'abc1234',
    branch: 'main',
    buildTime: '2026-11-06T20:00:00Z'
  });
  expect(new Date(res.body.startedAt).toString()).not.toBe('Invalid Date');
});
