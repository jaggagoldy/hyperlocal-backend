process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockGetBusinessBySlug = jest.fn();

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'customer-1' }; next(); },
  restrictTo: () => (req, res, next) => next(),
}));

jest.unstable_mockModule('../../../middlewares/verifyBusinessOwnership.js', () => ({
  default: (req, res, next) => next(),
}));

// getBusinessBySlug is exercised by the '/:slug' catch-all this test guards against.
jest.unstable_mockModule('../../../services/business.service.js', () => ({
  getBusinessBySlug: mockGetBusinessBySlug,
  createBusinessProfile: jest.fn(),
  updateBusinessProfile: jest.fn(),
  softDeleteBusinessProfile: jest.fn(),
  registerBusinessSelf: jest.fn(),
  getMyBusinesses: jest.fn(),
  getBusinessDashboardData: jest.fn(),
  submitVerificationRequest: jest.fn(),
  findPotentialDuplicates: jest.fn(),
  getSitemapSlugs: async () => [{ slug: 'sharma-sweets-karnal', updatedAt: '2026-01-01T00:00:00.000Z' }],
}));

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

describe('GET /business/sitemap/slugs (Sprint 3 Batch 4: Storefront SEO)', () => {
  beforeEach(() => {
    mockGetBusinessBySlug.mockReset();
  });

  test('is public (no Authorization header needed) and routed to the sitemap-slugs controller, not the /:slug catch-all', async () => {
    const app = buildApp();

    const res = await request(app).get('/business/sitemap/slugs');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ slug: 'sharma-sweets-karnal', updatedAt: '2026-01-01T00:00:00.000Z' }]);
    expect(mockGetBusinessBySlug).not.toHaveBeenCalled();
  });
});
