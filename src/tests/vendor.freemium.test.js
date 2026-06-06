import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../app.js';
import prisma from '../config/prisma.js';
import jwt from 'jsonwebtoken';

describe('Vendor Freemium API Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 403 Forbidden when a Free tier vendor attempts to update themeFlavor', async () => {
    // 1. Mock JWT verification to simulate a logged-in Vendor
    const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET || 'test-secret');
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-123' });

    // 2. Mock User DB lookup (for auth.middleware.js)
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-123',
      role: 'vendor',
      isActive: true,
    });

    // 3. Mock Vendor DB lookup (for vendor.service.js)
    jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({
      id: 'vendor-123',
      userId: 'user-123',
      membershipTier: 'Free', // Important: Free tier
      deletedAt: null,
    });
    
    jest.spyOn(prisma.businessProfile, 'update').mockResolvedValue({});

    // 4. Hit the API
    const response = await request(app)
      .patch('/api/v1/vendors/vendor-123')
      .set('Authorization', `Bearer ${token}`)
      .send({
        themeFlavor: 'luxury'
      });

    // 5. Assertions
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/Pro tier required for custom themes/i);
    expect(prisma.businessProfile.update).not.toHaveBeenCalled();
  });

  it('should allow Pro tier vendor to update themeFlavor', async () => {
    // 1. Mock JWT
    const token = jwt.sign({ id: 'user-456' }, process.env.JWT_SECRET || 'test-secret');
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user-456' });

    // 2. Mock User
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'user-456',
      role: 'vendor',
      isActive: true,
    });

    // 3. Mock Vendor (Pro)
    jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({
      id: 'vendor-456',
      userId: 'user-456',
      membershipTier: 'Pro', // Pro tier
      deletedAt: null,
    });

    jest.spyOn(prisma.businessProfile, 'update').mockResolvedValue({
      id: 'vendor-456',
      themeFlavor: 'luxury',
    });

    // 4. Hit the API
    const response = await request(app)
      .patch('/api/v1/vendors/vendor-456')
      .set('Authorization', `Bearer ${token}`)
      .send({
        themeFlavor: 'luxury'
      });

    // 5. Assertions
    expect(response.status).toBe(200);
    expect(prisma.businessProfile.update).toHaveBeenCalled();
  });
});
