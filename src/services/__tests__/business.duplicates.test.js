process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockFindMany = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: { businessProfile: { findMany: mockFindMany } },
}));

const { findPotentialDuplicates } = await import('../business.service.js');

describe('findPotentialDuplicates (Version 1.2 Sprint 3 Batch 2: Duplicate Prevention)', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  test('returns an empty array without querying when no business name is given', async () => {
    const result = await findPotentialDuplicates({ businessName: '   ', district: 'Karnal' });
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  test('queries by trimmed, case-insensitive name match and district', async () => {
    mockFindMany.mockResolvedValue([]);

    await findPotentialDuplicates({ businessName: '  Sharma Sweets  ', district: 'Karnal', state: 'Haryana' });

    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual(
      expect.arrayContaining([{ businessName: { contains: 'Sharma Sweets', mode: 'insensitive' } }])
    );
    expect(arg.where.city).toEqual({ district: 'Karnal' });
  });

  test('includes a pincode clause when a pincode is given', async () => {
    mockFindMany.mockResolvedValue([]);

    await findPotentialDuplicates({ businessName: 'Sharma Sweets', pincode: '132001' });

    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual(expect.arrayContaining([{ pincode: '132001' }]));
  });

  test('orders unclaimed candidates first (the "claim this instead" candidates)', async () => {
    mockFindMany.mockResolvedValue([{ id: 'biz-1', isClaimed: false }]);

    await findPotentialDuplicates({ businessName: 'Sharma Sweets' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ isClaimed: 'asc' }], take: 5 })
    );
  });

  test('does not filter by district when an invalid/unrecognized district is given (falls through as-is)', async () => {
    mockFindMany.mockResolvedValue([]);

    await findPotentialDuplicates({ businessName: 'Sharma Sweets', district: 'Not A Real District', state: 'Haryana' });

    const arg = mockFindMany.mock.calls[0][0];
    // isValidDistrict fails, so the raw (unnormalized) value is passed through rather than blocking the whole search.
    expect(arg.where.city).toEqual({ district: 'Not A Real District' });
  });
});
