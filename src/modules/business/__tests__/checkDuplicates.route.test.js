process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFindMany = jest.fn();
const mockGetBusinessBySlug = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: { businessProfile: { findMany: mockFindMany } },
}));

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'customer-1' }; next(); },
  restrictTo: () => (req, res, next) => next(),
}));

jest.unstable_mockModule('../../../middlewares/verifyBusinessOwnership.js', () => ({
  default: (req, res, next) => next(),
}));

// getBusinessBySlug is exercised by the '/:slug' catch-all this test guards against.
jest.unstable_mockModule('../../../services/business.service.js', () => {
  const actual = {};
  return {
    ...actual,
    getBusinessBySlug: mockGetBusinessBySlug,
    createBusinessProfile: jest.fn(),
    updateBusinessProfile: jest.fn(),
    softDeleteBusinessProfile: jest.fn(),
    registerBusinessSelf: jest.fn(),
    getMyBusinesses: jest.fn(),
    getBusinessDashboardData: jest.fn(),
    submitVerificationRequest: jest.fn(),
    findPotentialDuplicates: async ({ businessName }) => {
      mockFindMany(); // just to prove this path (not getBusinessBySlug) was hit
      return businessName ? [{ id: 'biz-1', businessName, isClaimed: false }] : [];
    },
    getSitemapSlugs: jest.fn(),
  };
});

jest.unstable_mockModule('../../../services/claim.service.js', () => ({
  initiateClaim: jest.fn(),
  verifyClaim: jest.fn(),
  upgradeTier: jest.fn(),
}));

jest.unstable_mockModule('../../../services/auth.service.js', () => ({
  createAuthResult: jest.fn(),
}));

const { default: businessRoutes } = await import('../business.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/business', businessRoutes);
  return app;
}

describe('GET /business/check-duplicates route ordering (Sprint 3 Batch 2 regression)', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockGetBusinessBySlug.mockReset();
  });

  test('is routed to the duplicate-check controller, not swallowed by the /:slug catch-all', async () => {
    const app = buildApp();

    const res = await request(app)
      .get('/business/check-duplicates')
      .query({ businessName: 'Sharma Sweets', district: 'Karnal' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 'biz-1', businessName: 'Sharma Sweets', isClaimed: false }]);
    // If '/:slug' had matched first, this would have been called with slug='check-duplicates' instead.
    expect(mockGetBusinessBySlug).not.toHaveBeenCalled();
  });
});
