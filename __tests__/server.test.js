const request = require('supertest');

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
});
