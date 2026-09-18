const request = require('supertest');
const db = require('../src/db');

jest.mock('../src/middleware/admin', () => ({
  requireAdmin: (req, _res, next) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  },
  requireSuperAdmin: (req, _res, next) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  },
  isAdminCapableRole: () => true,
  isSuperAdminRole: () => true
}));

jest.mock('../src/middleware/league', () => ({
  leagueAliasMiddleware: (req, _res, next) => {
    req.league = { id: 1, name: 'Test League', billing_entity_id: 1 };
    next();
  }
}));

// Mock the DB module so tests don't need a running database.
jest.mock('../src/db', () => {
  return {
    query: jest.fn(async (sql, params) => {
      const normalized = (sql || '').toString().toLowerCase();

      if (normalized.includes('from league_settings')) {
        return [[{ tournament_fee_18_holes: 100, tournament_fee_9_holes: 50 }], []];
      }

      if (normalized.includes('select id, number_of_holes from tournament')) {
        return [[], []];
      }

      if (normalized.includes('from players p') && normalized.includes('inner join league_players')) {
        if (normalized.includes('where lp.league_id = ? and p.email = ?')) {
          return [[], []];
        }
        return [[{ id: 1, name: 'Test User', email: 'test@example.com', created_at: new Date() }], []];
      }

      if (normalized.includes('from players where id = ?')) {
        return [[{ id: 2, name: 'Alice', email: 'alice@example.com', created_at: new Date() }], []];
      }

      return [[], []];
    }),
    execute: jest.fn(async (sql, params) => {
      // Fake an insert result
      return [{ insertId: 2 }, undefined];
    })
  };
});

const app = require('../src/server');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('npgolf API', () => {
  test('GET /api/players endpoint is available', async () => {
    const res = await request(app).get('/api/players');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/players returns an array', async () => {
    const res = await request(app).get('/api/players');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/players creates a user', async () => {
    const payload = { name: 'Alice', email: 'alice@example.com', password: 'SecurePass123' };
    const res = await request(app).post('/api/players').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
  });

  test('POST /api/players rejects weak password', async () => {
    const payload = { name: 'Bob', email: 'bob@example.com', password: 'weak' };
    const res = await request(app).post('/api/players').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /api/scores/tournament/:id/ctp-winners prefers managed winners and falls back per hole', async () => {
    db.query.mockImplementation(async (sql) => {
      const normalized = (sql || '').toString().toLowerCase();

      if (normalized.includes('select course_id, number_of_holes, nine_hole_side from tournament')) {
        return [[{ course_id: 11, number_of_holes: 18, nine_hole_side: 'front' }], []];
      }

      if (normalized.includes('from hole h') && normalized.includes('where h.course_id = ?') && normalized.includes('ht.par = 3')) {
        return [[
          { hole_id: 101, hole_number: 3, mens_par: 3 },
          { hole_id: 102, hole_number: 7, mens_par: 3 }
        ], []];
      }

      if (normalized.includes('from tournament_ctp_winners w') && normalized.includes('join players p on w.player_id = p.id')) {
        // Managed winner exists only for hole 3
        return [[
          {
            hole_id: 101,
            hole_number: 3,
            ctp_feet: 6,
            ctp_inches: 2,
            ctp_image_url: null,
            player_id: 501,
            player_name: 'Managed Winner',
            prize_money: 25
          }
        ], []];
      }

      if (normalized.includes('from scores s') && normalized.includes('join hole h on s.hole_id = h.id') && normalized.includes('and s.hole_id in')) {
        // Player-entered leaders for holes 3 and 7
        return [[
          {
            hole_id: 101,
            hole_number: 3,
            ctp_feet: 4,
            ctp_inches: 10,
            ctp_image_url: null,
            player_id: 601,
            player_name: 'Score Winner Hole 3'
          },
          {
            hole_id: 102,
            hole_number: 7,
            ctp_feet: 5,
            ctp_inches: 3,
            ctp_image_url: null,
            player_id: 602,
            player_name: 'Score Winner Hole 7'
          }
        ], []];
      }

      return [[], []];
    });

    const res = await request(app).get('/api/scores/tournament/1/ctp-winners');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    expect(res.body[0].hole_number).toBe(3);
    expect(res.body[0].player_name).toBe('Managed Winner');
    expect(res.body[0].player_id).toBe(501);

    expect(res.body[1].hole_number).toBe(7);
    expect(res.body[1].player_name).toBe('Score Winner Hole 7');
    expect(res.body[1].player_id).toBe(602);
  });

  test('GET /api/scores/tournament/:id/ctp-admin-options prepopulates unmanaged holes from player-entered values', async () => {
    db.query.mockImplementation(async (sql) => {
      const normalized = (sql || '').toString().toLowerCase();

      if (normalized.includes('select id, course_id, number_of_holes, nine_hole_side from tournament where id = ? limit 1')) {
        return [[{ id: 1, course_id: 22, number_of_holes: 18, nine_hole_side: 'front' }], []];
      }

      if (normalized.includes('from hole h') && normalized.includes('where h.course_id = ?') && normalized.includes('ht.par = 3')) {
        return [[
          { hole_id: 201, hole_number: 4, mens_par: 3 },
          { hole_id: 202, hole_number: 8, mens_par: 3 }
        ], []];
      }

      if (normalized.includes('from tournament_players tp') && normalized.includes('join players p on tp.player_id = p.id')) {
        return [[
          { id: 701, name: 'Player A' },
          { id: 702, name: 'Player B' }
        ], []];
      }

      if (normalized.includes('from tournament_ctp_winners w') && normalized.includes('join players p on p.id = w.player_id')) {
        // Managed row only for hole 4.
        return [[
          {
            hole_id: 201,
            hole_number: 4,
            player_id: 701,
            ctp_feet: 7,
            ctp_inches: 1,
            player_name: 'Player A'
          }
        ], []];
      }

      if (normalized.includes('from scores s') && normalized.includes('join hole h on h.id = s.hole_id') && normalized.includes('and s.hole_id in')) {
        // Score-derived leaders for holes 4 and 8; hole 8 should prepopulate because no managed row exists.
        return [[
          {
            hole_id: 201,
            hole_number: 4,
            player_id: 702,
            player_name: 'Player B',
            ctp_feet: 6,
            ctp_inches: 9
          },
          {
            hole_id: 202,
            hole_number: 8,
            player_id: 702,
            player_name: 'Player B',
            ctp_feet: 3,
            ctp_inches: 4
          }
        ], []];
      }

      return [[], []];
    });

    const res = await request(app).get('/api/scores/tournament/1/ctp-admin-options');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('holes');
    expect(res.body).toHaveProperty('players');
    expect(res.body).toHaveProperty('winners');

    expect(res.body.winners).toHaveLength(2);

    expect(res.body.winners[0].hole_number).toBe(4);
    expect(res.body.winners[0].player_name).toBe('Player A');
    expect(res.body.winners[0].player_id).toBe(701);

    expect(res.body.winners[1].hole_number).toBe(8);
    expect(res.body.winners[1].player_name).toBe('Player B');
    expect(res.body.winners[1].player_id).toBe(702);
  });
});
