process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const prismaMock = {
  businessProfile: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  auditLog: { create: jest.fn() },
};
// reviewVerificationRequest runs its update + audit write inside prisma.$transaction;
// the test double just invokes the callback with the same mocked client — no real
// transactional isolation is needed to test the business logic here.
prismaMock.$transaction = jest.fn((fn) => fn(prismaMock));

jest.unstable_mockModule('../../config/prisma.js', () => ({ default: prismaMock }));

const {
  computeCompleteness,
  computeVerificationReadiness,
  categorizeReadiness,
  submitVerificationRequest,
  getVerificationQueue,
  reviewVerificationRequest,
} = await import('../business.service.js');

function resetMocks() {
  Object.values(prismaMock.businessProfile).forEach((fn) => fn.mockReset());
  prismaMock.auditLog.create.mockReset();
  prismaMock.$transaction.mockClear();
}

const readyBusiness = {
  id: 'biz-1',
  deletedAt: null,
  verificationStatus: 'NOT_SUBMITTED',
  idVerified: false,
  media: [{ type: 'profile_image' }, { type: 'verification_doc' }],
  timeAvailability: '9am-9pm',
  workingDays: 'Mon-Sat',
  operatingHours: null,
  latitude: 29.68,
  longitude: 76.99,
  categories: [{ categoryId: 'cat-1' }],
  metaData: { about: 'A great local business.' },
  listingTier: 'DIRECTORY',
  catalogItems: [],
};

describe('Business Readiness Score (computeCompleteness) — regression for the operatingHours bug', () => {
  test('"hours" item is satisfied by timeAvailability/workingDays, not just the unused operatingHours field', () => {
    const result = computeCompleteness({ ...readyBusiness, idVerified: true });
    const hoursItem = result.items.find((i) => i.key === 'hours');
    expect(hoursItem.done).toBe(true);
  });

  test('"hours" item is NOT satisfied when neither field is set', () => {
    const result = computeCompleteness({ ...readyBusiness, idVerified: true, timeAvailability: null, workingDays: null, operatingHours: null });
    const hoursItem = result.items.find((i) => i.key === 'hours');
    expect(hoursItem.done).toBe(false);
  });

  test('still includes the "verify" item for the dashboard nudge', () => {
    const result = computeCompleteness({ ...readyBusiness, idVerified: false });
    expect(result.items.some((i) => i.key === 'verify')).toBe(true);
  });
});

describe('computeVerificationReadiness — the verification gate (Sprint 2 Batch 2)', () => {
  test('does not include "verify" as one of its own items (fixes the circularity bug)', () => {
    const result = computeVerificationReadiness(readyBusiness);
    expect(result.items.some((i) => i.key === 'verify')).toBe(false);
  });

  test('is ready when all base items + a verification_doc are present', () => {
    const result = computeVerificationReadiness(readyBusiness);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('is not ready when no verification_doc has been uploaded, even if everything else is complete', () => {
    const result = computeVerificationReadiness({ ...readyBusiness, media: [{ type: 'profile_image' }] });
    expect(result.ready).toBe(false);
    expect(result.missing.some((i) => i.key === 'verification_doc')).toBe(true);
  });

  test('is not ready when category is missing', () => {
    const result = computeVerificationReadiness({ ...readyBusiness, categories: [] });
    expect(result.ready).toBe(false);
    expect(result.missing.some((i) => i.key === 'category')).toBe(true);
  });
});

describe('submitVerificationRequest', () => {
  beforeEach(resetMocks);

  test('rejects submission when the readiness gate fails', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, media: [] });

    await expect(submitVerificationRequest('biz-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
  });

  test('rejects when a request is already pending', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });

    await expect(submitVerificationRequest('biz-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
  });

  test('rejects when already verified', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, idVerified: true });

    await expect(submitVerificationRequest('biz-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
  });

  test('allows resubmission after a rejection', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'REJECTED' });
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });

    const result = await submitVerificationRequest('biz-1');

    expect(result.verificationStatus).toBe('PENDING');
    expect(prismaMock.businessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verificationStatus: 'PENDING', verificationRejectionReason: null }) })
    );
  });

  test('succeeds and sets PENDING when the gate passes', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue(readyBusiness);
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });

    const result = await submitVerificationRequest('biz-1');

    expect(result.verificationStatus).toBe('PENDING');
  });
});

describe('getVerificationQueue', () => {
  beforeEach(resetMocks);

  test('queries only PENDING businesses, oldest first', async () => {
    prismaMock.businessProfile.findMany.mockResolvedValue([{ id: 'biz-1' }]);

    await getVerificationQueue();

    expect(prismaMock.businessProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { verificationStatus: 'PENDING' }, orderBy: { verificationSubmittedAt: 'asc' } })
    );
  });
});

describe('reviewVerificationRequest', () => {
  beforeEach(resetMocks);

  test('rejects an invalid decision value', async () => {
    await expect(reviewVerificationRequest('biz-1', 'MAYBE')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('requires a rejection reason when rejecting', async () => {
    await expect(reviewVerificationRequest('biz-1', 'REJECTED', '')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejects when there is no pending request for this business', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'NOT_SUBMITTED' });

    await expect(reviewVerificationRequest('biz-1', 'APPROVED')).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
  });

  test('approving sets idVerified=true and verificationStatus=APPROVED', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'APPROVED', idVerified: true });

    const result = await reviewVerificationRequest('biz-1', 'APPROVED');

    expect(result.idVerified).toBe(true);
    expect(prismaMock.businessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ verificationStatus: 'APPROVED', idVerified: true }) })
    );
  });

  test('rejecting stores the reason and does not set idVerified', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING', idVerified: false });
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'REJECTED' });

    await reviewVerificationRequest('biz-1', 'REJECTED', 'Document was blurry');

    expect(prismaMock.businessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationStatus: 'REJECTED',
          verificationRejectionReason: 'Document was blurry',
          idVerified: false,
        }),
      })
    );
  });

  test('records an audit log entry, in the same transaction, for an approval', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'APPROVED', idVerified: true });

    await reviewVerificationRequest('biz-1', 'APPROVED', undefined, { actorId: 'admin-1', actorRole: 'admin' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-1',
          actorRole: 'admin',
          action: 'VENDOR_VERIFICATION_APPROVED',
          entityType: 'BusinessProfile',
          entityId: 'biz-1',
        }),
      })
    );
  });

  test('records the rejection reason in the audit log metadata for a rejection', async () => {
    prismaMock.businessProfile.findUnique.mockResolvedValue({ ...readyBusiness, verificationStatus: 'PENDING' });
    prismaMock.businessProfile.update.mockResolvedValue({ ...readyBusiness, verificationStatus: 'REJECTED' });

    await reviewVerificationRequest('biz-1', 'REJECTED', 'Blurry document', { actorId: 'admin-1', actorRole: 'admin' });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VENDOR_VERIFICATION_REJECTED',
          metadata: { rejectionReason: 'Blurry document' },
        }),
      })
    );
  });
});

describe('categorizeReadiness (Version 1.2, Sprint 3 Batch 1: Business Readiness Categorization)', () => {
  test('does not change computeCompleteness\'s overall percent or computeVerificationReadiness\'s gate', () => {
    const before = computeCompleteness(readyBusiness);
    const gateBefore = computeVerificationReadiness(readyBusiness);

    categorizeReadiness(readyBusiness);

    const after = computeCompleteness(readyBusiness);
    const gateAfter = computeVerificationReadiness(readyBusiness);
    expect(after).toEqual(before);
    expect(gateAfter).toEqual(gateBefore);
  });

  test('overallPercent matches computeCompleteness\'s percent exactly', () => {
    const completeness = computeCompleteness(readyBusiness);
    const categorized = categorizeReadiness(readyBusiness);
    expect(categorized.overallPercent).toBe(completeness.percent);
  });

  test('identity category reflects idVerified only', () => {
    const verified = categorizeReadiness({ ...readyBusiness, idVerified: true });
    const unverified = categorizeReadiness({ ...readyBusiness, idVerified: false });

    expect(verified.categories.find((c) => c.key === 'identity').percent).toBe(100);
    expect(unverified.categories.find((c) => c.key === 'identity').percent).toBe(0);
  });

  test('profile category is a percentage across photo/hours/location/category/about', () => {
    const partial = categorizeReadiness({ ...readyBusiness, media: [], categories: [] });
    const profile = partial.categories.find((c) => c.key === 'profile');
    // hours, location, about are done; photo and category are not -> 3/5 = 60%
    expect(profile.percent).toBe(60);
  });

  test('catalog category is null/not-applicable for a DIRECTORY-tier business', () => {
    const result = categorizeReadiness({ ...readyBusiness, listingTier: 'DIRECTORY' });
    const catalog = result.categories.find((c) => c.key === 'catalog');
    expect(catalog.applicable).toBe(false);
    expect(catalog.percent).toBeNull();
  });

  test('catalog category is scored for a COMMERCE-tier business', () => {
    const withItems = categorizeReadiness({ ...readyBusiness, listingTier: 'COMMERCE', catalogItems: [{ id: 'item-1' }] });
    const withoutItems = categorizeReadiness({ ...readyBusiness, listingTier: 'COMMERCE', catalogItems: [] });

    expect(withItems.categories.find((c) => c.key === 'catalog')).toMatchObject({ applicable: true, percent: 100 });
    expect(withoutItems.categories.find((c) => c.key === 'catalog')).toMatchObject({ applicable: true, percent: 0 });
  });

  test('trust category is a read-only earned signal from reviews + rating, not an editable checklist', () => {
    const noReviewsLowRating = categorizeReadiness({ ...readyBusiness, reviews: [], rating: 0 });
    const someReviewsHighRating = categorizeReadiness({ ...readyBusiness, reviews: [{ id: 'r1' }], rating: 4.5 });

    const trustLow = noReviewsLowRating.categories.find((c) => c.key === 'trust');
    const trustHigh = someReviewsHighRating.categories.find((c) => c.key === 'trust');

    expect(trustLow.editable).toBe(false);
    expect(trustLow.percent).toBe(0);
    expect(trustHigh.percent).toBe(100);
    expect(trustHigh.detail).toEqual({ reviewCount: 1, rating: 4.5 });
  });

  test('falls back to _count.reviews when a bare reviews array is not loaded', () => {
    const result = categorizeReadiness({ ...readyBusiness, reviews: undefined, _count: { reviews: 2 }, rating: 3 });
    const trust = result.categories.find((c) => c.key === 'trust');
    expect(trust.detail.reviewCount).toBe(2);
    expect(trust.percent).toBe(50); // has reviews (+50), rating below 4.0 (+0)
  });
});
