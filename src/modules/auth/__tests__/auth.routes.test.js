process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('../auth.controller.js', () => ({
  registerController: (req, res) => res.status(201).json({ status: 'success' }),
  loginController: (req, res) => res.status(200).json({ status: 'success' }),
  forgotPasswordController: (req, res) => res.status(200).json({ status: 'success' }),
  resetPasswordController: (req, res) => res.status(200).json({ status: 'success' }),
  getMeController: (req, res) => res.status(200).json({ status: 'success' }),
  checkExistenceController: (req, res) => res.status(200).json({ status: 'success' }),
}));

const { default: authRoutes } = await import('../auth.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

describe('auth routes rate limiting (Batch 2 P0: login/register brute-force fix)', () => {
  test('login is rate-limited after the configured max attempts, and register now shares that same protection', async () => {
    const app = buildApp();

    // authLimiter allows 5 requests per 15-minute window outside development.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/auth/login').send({});
      expect(res.status).toBe(200);
    }

    const sixthLogin = await request(app).post('/auth/login').send({});
    expect(sixthLogin.status).toBe(429);

    // Before this batch /register had no rate limiter at all and would never
    // be blocked. It now shares the same authLimiter instance as /login, so
    // once the shared budget is exhausted, register must be blocked too.
    const registerAttempt = await request(app).post('/auth/register').send({});
    expect(registerAttempt.status).toBe(429);
  });
});
