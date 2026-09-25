// environment for the test suite
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-that-is-long-enough-1234567890';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '30';
process.env.APP_URL = 'http://localhost:8000';
