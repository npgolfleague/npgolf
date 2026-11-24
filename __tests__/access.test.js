// League boundaries and "own foursome only" scoring, with the real auth middleware.
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

let mockLeague = { id: 1, name: 'One', billing_entity_id: 1 };
jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => { if (mockLeague) req.league = mockLeague; next(); }
}));
jest.mock('../src/db', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { signAccessToken } = require('../src/utils/authTokens');
const app = require('../src/server');

// 1 super admin, 2 league admin of league 1, 3 and 4 players in league 1
// (foursomes A and B), 5 player in league 3 only.
const ROLES = { 1: 'super_admin', 2: 'league_admin', 3: 'player', 4: 'player', 5: 'player' };
const MEMBERS = { 1: [1, 2, 3, 4], 3: [5] };
const LEAGUE_OF = { 10: 1, 30: 3 };
let roster;
let completed;
let posted;
const conn = { query: jest.fn(async () => [{ insertId: 1 }]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };

const as = (id) => `Bearer ${signAccessToken({ id, password: 'h' }, process.env.JWT_SECRET, '1h')}`;
const call = (method, url, id, body) => request(app)[method](url).set('Authorization', as(id)).send(body);

beforeEach(() => {
  mockLeague = { id: 1, name: 'One', billing_entity_id: 1 };
  roster = [{ player_id: 3, foursome: 'A' }, { player_id: 6, foursome: 'A' }, { player_id: 4, foursome: 'B' }];
  completed = false;
  posted = false;
  conn.query.mockClear();
  pool.getConnection.mockReset().mockResolvedValue(conn);
  pool.execute.mockReset().mockResolvedValue([{ affectedRows: 1 }]);
  pool.query.mockReset().mockImplementation(async (sql, params = []) => {
    if (sql.startsWith('SELECT id, name, email, role, active, password')) {
      return [[{ id: params[0], name: 'U', email: 'u', role: ROLES[params[0]], active: 1, password: 'h' }]];
    }
    if (sql.startsWith('SELECT 1 FROM league_players')) return [(MEMBERS[params[0]] || []).includes(Number(params[1])) ? [{ 1: 1 }] : []];
    if (sql.startsWith('SELECT league_id FROM tournament')) return [LEAGUE_OF[params[0]] ? [{ league_id: LEAGUE_OF[params[0]] }] : []];
    if (sql.startsWith('SELECT season_id FROM tournament')) return [[{ season_id: null }]];
    if (sql.startsWith('SELECT 1 FROM tournament_paradise_points')) return [completed ? [{ 1: 1 }] : []];
    if (sql.startsWith('SELECT player_id, foursome FROM tournament_players')) return [roster];
    if (sql.startsWith('SELECT player_id FROM league_players')) return [params.slice(1).filter((id) => [...MEMBERS[1], 6].includes(id)).map((id) => ({ player_id: id }))];
    if (sql.startsWith('SELECT p.name FROM tournament_players tp')) return [posted ? [{ name: 'Pat' }] : []];
    if (sql.startsWith('SELECT id FROM players WHERE id IN')) return [params.map((id) => ({ id }))];
    if (sql.includes('AS is_completed')) return [[{ id: 10, league_id: 1, number_of_holes: 9, is_completed: completed ? 1 : 0 }]];
    return [[]];
  });
});

const score = (over = {}) => ({ scores: [{ tournament_id: 10, player_id: 3, hole_id: 1, score: 4, foursome_group: 'A', ...over }] });

describe('scores: own foursome only', () => {
  test('own and partner scores are accepted', async () => {
    await call('post', '/api/scores', 3, score()).expect(201);
    await call('post', '/api/scores', 3, score({ player_id: 6 })).expect(201);
  });

  test.each([
    ['another foursome', { player_id: 4, foursome_group: 'B' }],
    ['another foursome under my own label', { player_id: 4 }],
    ['my player under another label', { foursome_group: 'B' }],
    ['no label', { foursome_group: null }]
  ])('%s is refused', async (_l, over) => {
    await call('post', '/api/scores', 3, score(over)).expect(403);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('one bad score refuses the whole request', async () => {
    const body = { scores: [...score().scores, ...score({ player_id: 4 }).scores] };
    await call('post', '/api/scores', 3, body).expect(403);
  });

  test('a completed round or no foursome is refused; admins are not limited', async () => {
    completed = true;
    await call('post', '/api/scores', 3, score()).expect(403);
    await call('post', '/api/scores', 2, score({ player_id: 4, foursome_group: 'B' })).expect(201);
    completed = false;
    roster = [];
    const res = await call('post', '/api/scores', 3, score()).expect(403);
    expect(res.body.error).toMatch(/Add yourself/);
  });

  test.each([[{ id: 10 }], [['x']], [undefined], ['10 or 1']])('odd tournament id %p is refused', async (tournament_id) => {
    const res = await call('post', '/api/scores', 3, score({ tournament_id }));
    expect(res.status).toBe(400);
  });

  test('only the foursome can post its card', async () => {
    await call('post', '/api/scores/tournament/10/foursome/B/post', 3, {}).expect(403);
  });
});

describe('foursome changes', () => {
  const save = (id, playerIds) => call('put', '/api/tournaments/10/foursomes/A/roster', id, { playerIds });

  test('a player can rearrange foursomes, including moving someone in', async () => {
    await save(3, [3, 4]).expect(200);
    expect(conn.query).toHaveBeenCalled();
  });

  test('but not with someone outside the league, or from a posted card', async () => {
    await save(3, [3, 5]).expect(403);
    posted = true;
    await save(3, [3, 4]).expect(403);
    expect(conn.query).not.toHaveBeenCalled();
    await save(2, [3, 4]).expect(200);
  });
});

describe('league boundaries', () => {
  test.each([
    ['put', '/api/tournaments/30/collected'], ['delete', '/api/tournaments/30'], ['post', '/api/tournaments/30/complete'],
    ['put', '/api/tournaments/30/players/5/paid'], ['put', '/api/scores/tournament/30/ctp-winners'],
    ['put', '/api/tournaments/30/side-games'], ['get', '/api/tournaments/30/attendance'],
    ['post', '/api/cart-tags/tournament/30/send'], ['post', '/api/tournaments/30/results-email/send']
  ])('league admin cannot %s %s in another league', async (method, url) => {
    await call(method, url, 2, {}).expect(404);
  });

  test('a player from another league is refused', async () => {
    await call('get', '/api/players', 5).expect(403);
    await call('get', '/api/leagues/1/players', 5).expect(403);
    mockLeague = null;
    await call('get', '/api/players', 5).expect(403);
    await call('get', '/api/leagues/1/players', 5).expect(403);
    await call('get', '/api/leagues/3/players', 5).expect(200);
    await call('get', '/api/tournaments/10/attendance', 5).expect(403);
  });

  test('league admins see no shared inbox and cannot create leagues', async () => {
    expect((await call('get', '/api/emails', 2).expect(200)).body).toEqual([]);
    await call('get', '/api/emails/1', 2).expect(403);
    await call('delete', '/api/emails/1', 2).expect(403);
    await call('post', '/api/leagues', 2, {}).expect(403);
  });

  test('a round cannot be put in another league\'s season', async () => {
    await call('post', '/api/tournaments', 2, { date: '2027-03-17', course_id: 1, season_id: 99 }).expect(400);
  });
});
