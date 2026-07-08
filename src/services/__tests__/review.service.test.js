process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockOrderFindFirst = jest.fn();
const mockReviewFindFirst = jest.fn();
const mockReviewFindMany = jest.fn();
const mockReviewFindUnique = jest.fn();
const mockFeedbackCreate = jest.fn();
const mockFeedbackFindMany = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: {
    orderEnquiry: { findFirst: mockOrderFindFirst },
    review: { findFirst: mockReviewFindFirst, findMany: mockReviewFindMany, findUnique: mockReviewFindUnique },
    feedback: { create: mockFeedbackCreate, findMany: mockFeedbackFindMany },
    $transaction: mockTransaction,
  },
}));

const {
  createReview,
  getReviewsByVendor,
  reportReview,
  getReviewModerationQueue,
  hideReview,
  restoreReview,
} = await import('../review.service.js');

function resetMocks() {
  mockOrderFindFirst.mockReset();
  mockReviewFindFirst.mockReset();
  mockReviewFindMany.mockReset();
  mockReviewFindUnique.mockReset();
  mockFeedbackCreate.mockReset();
  mockFeedbackFindMany.mockReset();
  mockTransaction.mockReset();
}

describe('Reviews journey (smoke)', () => {
  beforeEach(resetMocks);

  describe('createReview', () => {
    test('rejects a review for a business the customer never completed an order with', async () => {
      mockOrderFindFirst.mockResolvedValue(null);

      await expect(
        createReview('customer-1', 'biz-1', 5, 'Great!', undefined)
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    test('rejects a second review on the same order', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'order-1' });
      mockReviewFindFirst.mockResolvedValue({ id: 'existing-review' });

      await expect(
        createReview('customer-1', 'biz-1', 5, 'Great!', 'order-1')
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    test('creates a review and refreshes the aggregate rating for a completed order', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'order-1' });
      mockReviewFindFirst.mockResolvedValue(null);

      const tx = {
        review: {
          create: jest.fn().mockResolvedValue({ id: 'review-1', rating: 5, businessProfileId: 'biz-1' }),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 } }),
        },
        businessProfile: { update: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(tx));

      const result = await createReview('customer-1', 'biz-1', 5, 'Great service!', 'order-1');

      expect(result.id).toBe('review-1');
      expect(tx.review.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ customerId: 'customer-1', businessProfileId: 'biz-1', rating: 5 }),
      }));
      // The aggregate must exclude hidden reviews (Sprint 2 Batch 5).
      expect(tx.review.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessProfileId: 'biz-1', isHidden: false } })
      );
      expect(tx.businessProfile.update).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        data: { rating: 4.5 },
      });
    });
  });

  describe('getReviewsByVendor', () => {
    test('returns only non-hidden reviews for a vendor, newest first', async () => {
      const reviews = [{ id: 'review-2' }, { id: 'review-1' }];
      mockReviewFindMany.mockResolvedValue(reviews);

      const result = await getReviewsByVendor('biz-1');

      expect(result).toBe(reviews);
      expect(mockReviewFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessProfileId: 'biz-1', isHidden: false }, orderBy: { createdAt: 'desc' } })
      );
    });
  });

  describe('reportReview (Sprint 2 Batch 5)', () => {
    test('rejects a report with no message', async () => {
      await expect(reportReview('customer-1', 'review-1', '')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockFeedbackCreate).not.toHaveBeenCalled();
    });

    test('rejects a report against a review that does not exist', async () => {
      mockReviewFindUnique.mockResolvedValue(null);

      await expect(reportReview('customer-1', 'review-1', 'This is spam')).rejects.toMatchObject({ statusCode: 404 });
      expect(mockFeedbackCreate).not.toHaveBeenCalled();
    });

    test('creates a pending Report feedback row linked to the review', async () => {
      mockReviewFindUnique.mockResolvedValue({ id: 'review-1' });
      mockFeedbackCreate.mockResolvedValue({ id: 'feedback-1' });

      await reportReview('customer-1', 'review-1', 'This is spam');

      expect(mockFeedbackCreate).toHaveBeenCalledWith({
        data: { userId: 'customer-1', type: 'Report', message: 'This is spam', status: 'pending', reviewId: 'review-1' },
      });
    });
  });

  describe('getReviewModerationQueue', () => {
    test('queries only pending reports that target a review', async () => {
      mockFeedbackFindMany.mockResolvedValue([{ id: 'feedback-1' }]);

      await getReviewModerationQueue();

      expect(mockFeedbackFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'Report', status: 'pending', reviewId: { not: null } } })
      );
    });
  });

  describe('hideReview', () => {
    test('rejects with no reason', async () => {
      await expect(hideReview('review-1', {}, '')).rejects.toMatchObject({ statusCode: 400 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    test('rejects a review that does not exist', async () => {
      mockReviewFindUnique.mockResolvedValue(null);
      await expect(hideReview('review-1', {}, 'Spam')).rejects.toMatchObject({ statusCode: 404 });
    });

    test('rejects a review that is already hidden', async () => {
      mockReviewFindUnique.mockResolvedValue({ id: 'review-1', isHidden: true });
      await expect(hideReview('review-1', {}, 'Spam')).rejects.toMatchObject({ statusCode: 409 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    test('hides the review, refreshes the rating excluding it, resolves pending reports, and audit-logs the action', async () => {
      mockReviewFindUnique.mockResolvedValue({ id: 'review-1', isHidden: false, businessProfileId: 'biz-1' });

      const tx = {
        review: {
          update: jest.fn().mockResolvedValue({ id: 'review-1', isHidden: true }),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 5 } }),
        },
        businessProfile: { update: jest.fn().mockResolvedValue({}) },
        feedback: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(tx));

      await hideReview('review-1', { actorId: 'admin-1', actorRole: 'admin' }, 'Contains abusive language');

      expect(tx.review.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'review-1' },
        data: expect.objectContaining({ isHidden: true, hiddenReason: 'Contains abusive language' }),
      }));
      expect(tx.feedback.updateMany).toHaveBeenCalledWith({
        where: { reviewId: 'review-1', status: 'pending' },
        data: { status: 'resolved' },
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'REVIEW_HIDDEN', entityType: 'Review', entityId: 'review-1', actorId: 'admin-1' }),
        })
      );
    });
  });

  describe('restoreReview', () => {
    test('rejects a review that is not hidden', async () => {
      mockReviewFindUnique.mockResolvedValue({ id: 'review-1', isHidden: false });
      await expect(restoreReview('review-1', {})).rejects.toMatchObject({ statusCode: 409 });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    test('restores the review, refreshes the rating including it again, and audit-logs the action', async () => {
      mockReviewFindUnique.mockResolvedValue({ id: 'review-1', isHidden: true, businessProfileId: 'biz-1' });

      const tx = {
        review: {
          update: jest.fn().mockResolvedValue({ id: 'review-1', isHidden: false }),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.2 } }),
        },
        businessProfile: { update: jest.fn().mockResolvedValue({}) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      };
      mockTransaction.mockImplementation(async (fn) => fn(tx));

      await restoreReview('review-1', { actorId: 'admin-1', actorRole: 'admin' });

      expect(tx.review.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'review-1' },
        data: { isHidden: false, hiddenReason: null, hiddenAt: null },
      }));
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'REVIEW_RESTORED', entityId: 'review-1' }) })
      );
    });
  });
});
