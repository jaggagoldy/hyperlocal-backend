process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const prismaMock = {
  user: { update: jest.fn() },
  businessProfile: { update: jest.fn() },
  auditLog: { create: jest.fn(), findMany: jest.fn() },
};
prismaMock.$transaction = jest.fn((fn) => fn(prismaMock));

jest.unstable_mockModule('../../../config/prisma.js', () => ({ default: prismaMock }));

jest.unstable_mockModule('../../../services/business.service.js', () => ({
  getVerificationQueue: jest.fn(),
  reviewVerificationRequest: jest.fn(),
}));

jest.unstable_mockModule('../../../services/whatsapp.service.js', () => ({
  default: { sendRFQNotification: jest.fn().mockResolvedValue({ success: true }) },
}));

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  requireSuperadmin: (req, res, next) => next(),
}));

const { default: superadminRoutes } = await import('../superadmin.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/superadmin', superadminRoutes);
  return app;
}

function resetMocks() {
  prismaMock.user.update.mockReset();
  prismaMock.businessProfile.update.mockReset();
  prismaMock.auditLog.create.mockReset();
  prismaMock.$transaction.mockClear();
}

describe('Superadmin mutation endpoints write an audit log entry (Sprint 2 Batch 4)', () => {
  beforeEach(resetMocks);

  test('PATCH /users/:id/ban records USER_BANNED with the acting admin', async () => {
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', isBanned: true });
    const app = buildApp();

    const res = await request(app).patch('/superadmin/users/user-1/ban').send({ isBanned: true });

    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'admin-1', actorRole: 'admin', action: 'USER_BANNED', entityType: 'User', entityId: 'user-1' }),
      })
    );
  });

  test('PATCH /vendors/:id/suspend records VENDOR_STATUS_CHANGED', async () => {
    prismaMock.businessProfile.update.mockResolvedValue({ id: 'biz-1', status: 'suspended' });
    const app = buildApp();

    const res = await request(app).patch('/superadmin/vendors/biz-1/suspend').send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VENDOR_STATUS_CHANGED', entityType: 'BusinessProfile', entityId: 'biz-1', metadata: { status: 'suspended' } }),
      })
    );
  });

  test('PATCH /vendors/:id/verify (manual override) records VENDOR_ID_VERIFIED_MANUAL_OVERRIDE', async () => {
    prismaMock.businessProfile.update.mockResolvedValue({ id: 'biz-1', idVerified: true });
    const app = buildApp();

    const res = await request(app).patch('/superadmin/vendors/biz-1/verify').send({ idVerified: true });

    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VENDOR_ID_VERIFIED_MANUAL_OVERRIDE', entityId: 'biz-1' }),
      })
    );
  });

  test('PATCH /vendors/:id/feature records VENDOR_FEATURED', async () => {
    prismaMock.businessProfile.update.mockResolvedValue({ id: 'biz-1', isFeatured: true });
    const app = buildApp();

    const res = await request(app).patch('/superadmin/vendors/biz-1/feature').send({ isFeatured: true });

    expect(res.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'VENDOR_FEATURED', entityId: 'biz-1' }),
      })
    );
  });

  test('GET /audit-log returns entries and supports entityType/entityId filters', async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ id: 'log-1', action: 'USER_BANNED' }]);
    const app = buildApp();

    const res = await request(app).get('/superadmin/audit-log').query({ entityType: 'User', entityId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: 'log-1', action: 'USER_BANNED' }]);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entityType: 'User', entityId: 'user-1' } })
    );
  });
});
