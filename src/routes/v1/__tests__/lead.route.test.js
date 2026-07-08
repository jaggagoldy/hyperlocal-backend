process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFindFirst = jest.fn();
const mockGetVendorLeads = jest.fn();
const mockUpdateLeadStatus = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: { businessProfile: { findFirst: mockFindFirst } },
}));

jest.unstable_mockModule('../../../services/lead.service.js', () => ({
  getVendorLeads: mockGetVendorLeads,
  updateLeadStatus: mockUpdateLeadStatus,
}));

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || 'no-user', role: 'vendor' };
    next();
  },
  restrictTo: () => (req, res, next) => next(),
}));

const { default: leadRoutes } = await import('../lead.route.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/leads', leadRoutes);
  return app;
}

describe('lead routes ownership enforcement (Batch 2: cross-vendor lead IDOR fix)', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockGetVendorLeads.mockReset();
    mockUpdateLeadStatus.mockReset();
  });

  test('GET /leads is rejected (403) when x-business-id does not belong to the caller', async () => {
    mockFindFirst.mockResolvedValue(null); // attacker does not own 'victim-business'
    const app = buildApp();

    const res = await request(app)
      .get('/leads')
      .set('x-test-user-id', 'attacker')
      .set('x-business-id', 'victim-business');

    expect(res.status).toBe(403);
    expect(mockGetVendorLeads).not.toHaveBeenCalled();
  });

  test('GET /leads succeeds and passes the verified business id when the caller owns it', async () => {
    mockFindFirst.mockResolvedValue({ id: 'my-business', userId: 'owner' });
    mockGetVendorLeads.mockResolvedValue([{ id: 'lead-1' }]);
    const app = buildApp();

    const res = await request(app)
      .get('/leads')
      .set('x-test-user-id', 'owner')
      .set('x-business-id', 'my-business');

    expect(res.status).toBe(200);
    expect(mockGetVendorLeads).toHaveBeenCalledWith('my-business');
  });

  test('PATCH /leads/:id/status is rejected (403) when the business does not belong to the caller', async () => {
    mockFindFirst.mockResolvedValue(null);
    const app = buildApp();

    const res = await request(app)
      .patch('/leads/lead-1/status')
      .set('x-test-user-id', 'attacker')
      .send({ businessId: 'victim-business', status: 'REJECTED' });

    expect(res.status).toBe(403);
    expect(mockUpdateLeadStatus).not.toHaveBeenCalled();
  });

  test('PATCH /leads/:id/status succeeds and uses the verified business id when owned', async () => {
    mockFindFirst.mockResolvedValue({ id: 'my-business', userId: 'owner' });
    mockUpdateLeadStatus.mockResolvedValue({ id: 'lead-1', status: 'CONTACTED' });
    const app = buildApp();

    const res = await request(app)
      .patch('/leads/lead-1/status')
      .set('x-test-user-id', 'owner')
      .send({ businessId: 'my-business', status: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(mockUpdateLeadStatus).toHaveBeenCalledWith('lead-1', 'my-business', expect.objectContaining({ status: 'CONTACTED' }));
  });
});
