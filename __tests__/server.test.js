const request = require('supertest');

// Mock the DB module so tests don't need a running database.
jest.mock('../src/db', () => {
  return {
    query: jest.fn(async (sql, params) => {
      // Return a sample user row for SELECT queries
      if (sql && sql.toString().toLowerCase().includes('select')) {
        return [[{ id: 1, name: 'Test User', email: 'test@example.com', created_at: new Date() }], []];
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

describe('npgolf API', () => {
  test('GET /api/users endpoint is available', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/users returns an array', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/users creates a user', async () => {
    const payload = { name: 'Alice', email: 'alice@example.com', password: 'SecurePass123' };
    const res = await request(app).post('/api/users').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
  });

  test('POST /api/users rejects weak password', async () => {
    const payload = { name: 'Bob', email: 'bob@example.com', password: 'weak' };
    const res = await request(app).post('/api/users').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
