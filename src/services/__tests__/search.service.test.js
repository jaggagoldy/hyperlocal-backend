process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: { businessProfile: { findMany: mockFindMany, count: mockCount } },
}));

// Ranking is a separate concern (not part of this batch); use an identity
// passthrough so this test only exercises the search/filter/pagination logic.
jest.unstable_mockModule('../ranking.service.js', () => ({
  rankResults: (vendors) => vendors,
}));

const { exploreVendors } = await import('../search.service.js');

describe('Search journey (smoke)', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockCount.mockReset();
  });

  test('returns paginated results with correct meta for a basic query', async () => {
    const vendors = [{ id: 'biz-1' }, { id: 'biz-2' }];
    mockFindMany.mockResolvedValue(vendors);
    mockCount.mockResolvedValue(2);

    const result = await exploreVendors('karnal', 'restaurants', { query: 'pizza' });

    expect(result.data).toEqual(vendors);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  test('applies the text search filter across name/locality/catalog fields', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await exploreVendors(null, null, { query: 'plumber' });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ businessName: { contains: 'plumber', mode: 'insensitive' } }),
      ])
    );
  });

  test('restricts to ENABLED_VERTICALS by default (transactional scope)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await exploreVendors(null, null, {});

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.businessType.in).not.toContain('DIRECTORY_ONLY_STUB_TYPE');
    expect(Array.isArray(whereArg.businessType.in)).toBe(true);
    expect(whereArg.businessType.in.length).toBeGreaterThan(0);
  });

  test('paginates using page/limit query options', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(45);

    const result = await exploreVendors(null, null, { page: '2', limit: '20' });

    expect(mockFindMany.mock.calls[0][0].skip).toBe(20);
    expect(mockFindMany.mock.calls[0][0].take).toBe(20);
    expect(result.meta).toEqual({ total: 45, page: 2, limit: 20, totalPages: 3 });
  });
});
