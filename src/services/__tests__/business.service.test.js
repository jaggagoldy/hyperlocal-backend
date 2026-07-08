process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const prismaMock = {
  city: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  businessProfile: { findUnique: jest.fn(), create: jest.fn() },
  category: { findFirst: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
};

jest.unstable_mockModule('../../config/prisma.js', () => ({ default: prismaMock }));

const { createBusinessProfile, registerBusinessSelf, getBusinessBySlug } = await import('../business.service.js');

function resetPrismaMock() {
  Object.values(prismaMock).forEach((model) => {
    Object.values(model).forEach((fn) => fn.mockReset());
  });
}

describe('Vendor onboarding journey (smoke)', () => {
  beforeEach(resetPrismaMock);

  describe('createBusinessProfile validation', () => {
    test('rejects a vertical that is not enabled', async () => {
      await expect(
        createBusinessProfile({ businessName: 'X', localityName: 'Y', district: 'Karnal', businessType: 'NOT_A_REAL_VERTICAL' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('rejects onboarding with no district', async () => {
      await expect(
        createBusinessProfile({ businessName: 'X', localityName: 'Y', businessType: 'FOOD_BEVERAGE' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('rejects an invalid district for the state', async () => {
      await expect(
        createBusinessProfile({ businessName: 'X', localityName: 'Y', businessType: 'FOOD_BEVERAGE', district: 'Not A Real District' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('rejects a duplicate registration number', async () => {
      prismaMock.businessProfile.findUnique.mockResolvedValueOnce({ id: 'existing-biz' }); // registrationNumber lookup hits

      await expect(
        createBusinessProfile({
          businessName: 'X', localityName: 'Y', businessType: 'FOOD_BEVERAGE', district: 'Karnal', registrationNumber: 'REG-DUPE',
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('createBusinessProfile happy path', () => {
    test('creates a business profile for a valid, enabled vertical + district', async () => {
      prismaMock.businessProfile.findUnique.mockResolvedValue(null); // no registrationNumber / no slug collision
      prismaMock.city.findUnique.mockResolvedValue(null); // city doesn't exist yet
      prismaMock.city.create.mockResolvedValue({ id: 'city-1', name: 'Karnal', slug: 'karnal', district: 'Karnal' });
      prismaMock.category.findFirst.mockResolvedValue({ id: 'cat-general' });
      prismaMock.businessProfile.create.mockResolvedValue({
        id: 'biz-1', businessName: 'Test Diner', slug: 'test-diner-x-karnal', businessType: 'FOOD_BEVERAGE',
      });

      const result = await createBusinessProfile({
        businessName: 'Test Diner', localityName: 'X', businessType: 'FOOD_BEVERAGE', district: 'Karnal',
      });

      expect(result.id).toBe('biz-1');
      expect(prismaMock.city.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.businessProfile.create).toHaveBeenCalledTimes(1);
      const createArgs = prismaMock.businessProfile.create.mock.calls[0][0];
      expect(createArgs.data.businessType).toBe('FOOD_BEVERAGE');
      expect(createArgs.data.cityId).toBe('city-1');
    });
  });

  describe('registerBusinessSelf', () => {
    test('rejects when the authenticated user no longer exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(registerBusinessSelf('ghost-user-id', { businessName: 'X' })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getBusinessBySlug (business discovery)', () => {
    test('returns the business for a known slug', async () => {
      const business = { id: 'biz-1', slug: 'test-diner', businessName: 'Test Diner' };
      prismaMock.businessProfile.findUnique.mockResolvedValue(business);

      const result = await getBusinessBySlug('test-diner');

      expect(result).toBe(business);
      expect(prismaMock.businessProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'test-diner', deletedAt: null } })
      );
    });

    test('404s for an unknown slug', async () => {
      prismaMock.businessProfile.findUnique.mockResolvedValue(null);

      await expect(getBusinessBySlug('does-not-exist')).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
