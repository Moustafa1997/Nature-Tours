// http level tests that do not need a database
jest.mock('../utils/email');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

describe('app (no database)', () => {
  test('unknown api route returns a json 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Cannot find/);
  });

  test('security headers are set', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('health reports the database state', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.database).toBe('disconnected');
  });

  test('protected routes need a token', async () => {
    for (const url of [
      '/api/v1/users/me',
      '/api/v1/bookings/userBookings',
      '/api/v1/users/favorites',
      '/api/v1/reviews/my-reviews',
    ]) {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
    }
  });

  test('tokens signed with "none" or another secret are rejected', async () => {
    const none = jwt.sign({ id: 'x' }, '', { algorithm: 'none' });
    const other = jwt.sign({ id: 'x' }, 'another-secret');
    for (const token of [none, other]) {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  test('login rejects NoSQL injection objects', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
  });

  test('refresh without a token is rejected', async () => {
    const res = await request(app).post('/api/v1/users/refreshToken');
    // no token => lookup is skipped => 401 without touching the db
    expect(res.status).toBe(401);
  });

  test('pages that need a login redirect to /login', async () => {
    for (const url of ['/me', '/my-tours', '/my-reviews', '/my-favorites']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login');
    }
  });

  test('public pages render', async () => {
    for (const url of ['/login', '/signup', '/forgot-password', '/reset-password/abc']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/<html/);
    }
  });

  test('big json bodies are refused', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ email: 'a'.repeat(20000), password: 'x' });
    expect(res.status).toBe(413);
  });
});
