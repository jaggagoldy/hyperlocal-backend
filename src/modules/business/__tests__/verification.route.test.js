process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFindFirst = jest.fn(); // for verifyBusinessOwnership
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: {
    businessProfile: { findFirst: mockFindFirst, findUnique: mockFindUnique, update: mockUpdate },
  },
}));

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'owner-1' }; next(); },
  restrictTo: () => (req, res, next) => next(),
}));

const { default: businessRoutes } = await import('../business.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/business', businessRoutes);
  return app;
}

const readyBusiness = {
  id: 'biz-1',
  userId: 'owner-1',
  deletedAt: null,
  verificationStatus: 'NOT_SUBMITTED',
  idVerified: false,
  media: [{ type: 'verification_doc' }],
  timeAvailability: '9am-9pm',
  workingDays: null,
  operatingHours: null,
  latitude: 29.68,
  longitude: 76.99,
  categories: [{ categoryId: 'cat-1' }],
  metaData: { about: 'A great local business.' },
  listingTier: 'DIRECTORY',
  catalogItems: [],
};

describe('POST /business/me/verification/submit (Sprint 2 Batch 2)', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  test('rejects (403) when the caller does not own the business', async () => {
    mockFindFirst.mockResolvedValue(null);
    const app = buildApp();

    const res = await request(app)
      .post('/business/me/verification/submit')
      .set('x-business-id', 'biz-1');

    expect(res.status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test('rejects (400) when the readiness gate fails, even for the owner', async () => {
    mockFindFirst.mockResolvedValue(readyBusiness);
    mockFindUnique.mockResolvedValue({ ...readyBusiness, media: [] });
    const app = buildApp();

    const res = await request(app)
      .post('/business/me/verification/submit')
      .set('x-business-id', 'biz-1');

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('succeeds (200) for the owner when the gate passes', async () => {
    mockFindFirst.mockResolvedValue(readyBusiness);
    mockFindUnique.mockResolvedValue(readyBusiness);
    mockUpdate.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });
    const app = buildApp();

    const res = await request(app)
      .post('/business/me/verification/submit')
      .set('x-business-id', 'biz-1');

    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe('PENDING');
  });
});
