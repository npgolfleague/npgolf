// Season rollover rules in src/seasons.js.
const request = require('supertest');

jest.mock('../src/middleware/admin', () => ({
  requireAdmin: (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); },
  requireSuperAdmin: (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); },
  requireAnyAdmin: (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); },
  requireAuth: (req, _res, next) => { req.user = { id: 1, role: 'super_admin' }; next(); },
  assertLeagueAdmin: async () => {},
  assertTournamentAccess: async () => {},
  AuthError: class AuthError extends Error {},
  isAdminCapableRole: () => true,
  isSuperAdminRole: () => true
}));

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => {
    req.league = { id: 1, name: 'Test League', billing_entity_id: 1 };
    next();
  }
}));

jest.mock('../src/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/db');
const { rankSeasonStandings, normalizeRolloverOptions, assertSeasonOpen, SeasonError } = require('../src/seasons');
const app = require('../src/server');

describe('rollover options', () => {
  test('defaults: next year, keep quotas, pots reset, unplayed tournaments move', () => {
    expect(normalizeRolloverOptions({}, 2027)).toEqual({
      newYear: 2027, quotaMode: 'keep', quota18: null, quota9: null, carryPots: false, moveUnplayed: true
    });
  });

  test('a starting quota is required when resetting quotas', () => {
    expect(() => normalizeRolloverOptions({ quota_mode: 'set' }, 2027)).toThrow(SeasonError);
    expect(normalizeRolloverOptions({ quota_mode: 'set', quota_18: '30' }, 2027))
      .toMatchObject({ quotaMode: 'set', quota18: 30, quota9: null });
  });

  test('quota values are ignored when keeping quotas', () => {
    expect(normalizeRolloverOptions({ quota_mode: 'keep', quota_18: 30 }, 2027).quota18).toBeNull();
  });

  test('bad input is rejected', () => {
    expect(() => normalizeRolloverOptions({ quota_mode: 'wipe' }, 2027)).toThrow('Invalid quota option');
    expect(() => normalizeRolloverOptions({ new_season_year: 'abc' }, 2027)).toThrow('Invalid new season year');
    expect(() => normalizeRolloverOptions({ quota_mode: 'set', quota_18: 150 }, 2027)).toThrow(/whole number/);
  });
});

describe('final ranking', () => {
  const row = (player_id, regular_points, playoff_points, is_finalist) => (
    { player_id, player_name: `P${player_id}`, regular_points, playoff_points, is_finalist, fedex_points: regular_points, prize_money: 0 });
  const order = (rows, champion) => rankSeasonStandings(rows, champion).map((r) => r.player_id);

  test('finalists rank by playoff points, ahead of non-finalists with more total points', () => {
    const rows = [row(1, 853, 220, 1), row(2, 766, 250, 1), row(3, 606, 320, 1), row(4, 754, 200, 1), row(5, 686, 210, 1), row(6, 900, 150, 0)];
    expect(order(rows, 3)).toEqual([3, 2, 1, 5, 4, 6]);
  });

  test('the champion is first even when tied on playoff points; regular points break other ties', () => {
    expect(order([row(1, 800, 250, 1), row(2, 700, 250, 1), row(3, 750, 250, 1)], 2)).toEqual([2, 1, 3]);
  });

  test('without playoffs, ranks by FedEx points', () => {
    expect(order([row(1, 100, 0, 0), row(2, 300, 0, 0)], null)).toEqual([2, 1]);
  });
});

describe('closed seasons are read-only', () => {
  beforeEach(() => pool.query.mockReset());

  test('assertSeasonOpen throws 409 for a closed season', async () => {
    pool.query.mockResolvedValueOnce([[{ season_year: 2025, status: 'closed' }]]);
    await expect(assertSeasonOpen(pool, 5)).rejects.toMatchObject({ status: 409 });
  });

  test('assertSeasonOpen passes for an open season or no season', async () => {
    pool.query.mockResolvedValueOnce([[{ season_year: 2026, status: 'open' }]]);
    await expect(assertSeasonOpen(pool, 6)).resolves.toBeUndefined();
    await expect(assertSeasonOpen(pool, null)).resolves.toBeUndefined();
  });

  test('editing a tournament in a closed season returns 409', async () => {
    pool.query
      .mockResolvedValueOnce([[{ season_id: 5 }]])                        // tournament's season
      .mockResolvedValueOnce([[{ season_year: 2025, status: 'closed' }]]); // season status
    const res = await request(app).delete('/api/tournaments/12');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/2025 season is closed/);
  });
});

describe('closed seasons block roster, score and side-game changes', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockImplementation(async (sql) => {
      if (sql.startsWith('SELECT tournament_id FROM scores')) return [[{ tournament_id: 12 }]];
      if (sql.startsWith('SELECT season_id FROM tournament')) return [[{ season_id: 5 }]];
      if (sql.startsWith('SELECT season_year, status')) return [[{ season_year: 2025, status: 'closed' }]];
      throw new Error(`Unexpected query: ${sql}`);
    });
  });

  test.each([
    ['post', '/api/scores', { scores: [{ tournament_id: 12, player_id: 1, hole_id: 1, score: 4 }] }],
    ['put', '/api/scores/7', { score: 4 }],
    ['delete', '/api/scores/7', undefined],
    ['put', '/api/scores/tournament/12/ctp-winners', { winners: [] }],
    ['post', '/api/scores/tournament/12/foursome/1/reopen', {}],
    ['post', '/api/tournaments/12/players', { player_id: 1 }],
    ['put', '/api/tournaments/12/players/1/paid', { paid: true }],
    ['put', '/api/tournaments/12/foursomes/1/roster', {}],
    ['put', '/api/tournaments/12/side-games', { games: [] }],
    ['post', '/api/tournaments/12/playoff/champion-tiebreak', {}]
  ])('%s %s returns 409', async (method, url, body) => {
    const res = await request(app)[method](url).send(body);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/2025 season is closed/);
  });
});

describe('rollover endpoint', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('refuses while a tournament has scores but is not completed', async () => {
    const season = { id: 3, league_id: 1, season_year: 2026, status: 'open' };
    const conn = {
      query: jest.fn(async (sql) => {
        if (sql.startsWith('SELECT season_year FROM leagues')) return [[{ season_year: 2026 }]];
        if (sql.startsWith('INSERT IGNORE INTO league_seasons')) return [{}];
        if (sql.startsWith('SELECT * FROM league_seasons WHERE league_id = ? AND season_year')) return [[season]];
        if (sql.includes('FROM tournament t') && sql.includes('has_scores')) {
          return [[{ id: 9, date: '2026-10-01', number_of_holes: 18, playoff_stage: 'regular', course_name: 'X', is_completed: 0, has_scores: 1 }]];
        }
        if (sql.startsWith('SELECT playoff_format')) return [[{ playoff_format: 'none' }]];
        if (sql.startsWith('SELECT id, status FROM league_seasons')) return [[]];
        if (sql.startsWith('SELECT COUNT(*) AS n FROM league_players')) return [[{ n: 10 }]];
        return [[]];
      }),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValue(conn);

    const res = await request(app).post('/api/leagues/1/seasons/rollover').send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/aren't completed/);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });
});
