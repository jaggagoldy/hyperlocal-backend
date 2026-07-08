import { jest } from '@jest/globals';

const mockFindFirst = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: {
    businessProfile: { findFirst: mockFindFirst },
  },
}));

const { default: verifyBusinessOwnership } = await import('../verifyBusinessOwnership.js');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('verifyBusinessOwnership (Batch 2 P0: media + lead IDOR fix)', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  test('attaches req.business and calls next when the caller owns the business', async () => {
    const business = { id: 'biz-1', userId: 'user-1' };
    mockFindFirst.mockResolvedValue(business);
    const req = { headers: { 'x-business-id': 'biz-1' }, query: {}, body: {}, user: { id: 'user-1' } };
    const res = mockRes();
    const next = jest.fn();

    await verifyBusinessOwnership(req, res, next);

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'biz-1', userId: 'user-1' } });
    expect(req.business).toBe(business);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 and does not call next for a business the caller does not own (IDOR attempt)', async () => {
    // findFirst is scoped to req.user.id, so a business owned by someone else resolves to null.
    mockFindFirst.mockResolvedValue(null);
    const req = { headers: { 'x-business-id': 'someone-elses-biz' }, query: {}, body: {}, user: { id: 'attacker' } };
    const res = mockRes();
    const next = jest.fn();

    await verifyBusinessOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.business).toBeUndefined();
  });

  test('returns 400 when no business id is supplied via header, query, or body', async () => {
    const req = { headers: {}, query: {}, body: {}, user: { id: 'user-1' } };
    const res = mockRes();
    const next = jest.fn();

    await verifyBusinessOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts req.body.vendorId as a fallback (media upload/delete API contract)', async () => {
    const business = { id: 'biz-2', userId: 'user-2' };
    mockFindFirst.mockResolvedValue(business);
    const req = { headers: {}, query: {}, body: { vendorId: 'biz-2' }, user: { id: 'user-2' } };
    const res = mockRes();
    const next = jest.fn();

    await verifyBusinessOwnership(req, res, next);

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'biz-2', userId: 'user-2' } });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects a body.vendorId belonging to a different vendor (media IDOR regression)', async () => {
    mockFindFirst.mockResolvedValue(null);
    const req = { headers: {}, query: {}, body: { vendorId: 'victim-business' }, user: { id: 'attacker' } };
    const res = mockRes();
    const next = jest.fn();

    await verifyBusinessOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
