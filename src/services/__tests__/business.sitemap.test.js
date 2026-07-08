process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockFindMany = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: { businessProfile: { findMany: mockFindMany } },
}));

const { getSitemapSlugs } = await import('../business.service.js');

describe('getSitemapSlugs (Version 1.2 Sprint 3 Batch 4: Storefront SEO)', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  test('queries only non-deleted businesses, selecting just slug and updatedAt', async () => {
    mockFindMany.mockResolvedValue([]);

    await getSitemapSlugs();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: { slug: true, updatedAt: true },
    });
  });

  test('returns whatever prisma resolves, unmodified', async () => {
    const rows = [{ slug: 'sharma-sweets-karnal', updatedAt: new Date('2026-01-01') }];
    mockFindMany.mockResolvedValue(rows);

    const result = await getSitemapSlugs();

    expect(result).toEqual(rows);
  });
});
