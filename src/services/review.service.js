import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';
import { recordAuditLog } from './auditLog.service.js';

// Shared so every write path (create, hide, restore) recalculates the same
// way, always excluding hidden reviews — a review hidden for cause shouldn't
// keep counting toward the vendor's public trust score.
const refreshBusinessRating = async (tx, businessProfileId) => {
  const agg = await tx.review.aggregate({
    _avg: { rating: true },
    where: { businessProfileId, isHidden: false },
  });
  await tx.businessProfile.update({
    where: { id: businessProfileId },
    data: { rating: agg._avg.rating ?? 0 },
  });
};

// NOTE: the public API param is named `vendorId` (kept stable for callers), but its
// value is a BusinessProfile id — both Review and OrderEnquiry key off
// `businessProfileId`, so we map it through here.
export const createReview = async (customerId, businessProfileId, rating, comment, orderId) => {
  // Verify the customer has a completed order with this business.
  let completedOrder;
  if (orderId) {
    completedOrder = await prisma.orderEnquiry.findFirst({
      where: {
        id: orderId,
        customerId,
        businessProfileId,
        status: 'COMPLETED',
      },
    });
  } else {
    completedOrder = await prisma.orderEnquiry.findFirst({
      where: {
        customerId,
        businessProfileId,
        status: 'COMPLETED',
      },
    });
  }

  if (!completedOrder) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You can only review businesses you have ordered from.');
  }

  // Prevent multiple reviews on the same orderId if specified
  if (orderId) {
    const existingReview = await prisma.review.findFirst({
      where: { orderId }
    });
    if (existingReview) {
      throw new AppError(StatusCodes.CONFLICT, 'You have already rated this booking.');
    }
  }

  // Create the review and refresh the business's aggregate rating in one transaction,
  // so the directory card stars and schema.org aggregateRating JSON-LD stay in sync.
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        customerId,
        businessProfileId,
        orderId: completedOrder.id,
        rating,
        comment: comment || null,
      },
    });

    await refreshBusinessRating(tx, businessProfileId);

    return created;
  });

  return review;
};

export const getReviewsByVendor = async (businessProfileId) => {
  return await prisma.review.findMany({
    where: { businessProfileId, isHidden: false },
    include: {
      customer: {
        select: {
          name: true,
          customerName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

// ─── Sprint 2 Batch 5: Moderation ───────────────────────────────────────────
// Deliberately small scope, per the Founder's direction: report a review,
// an admin can hide/restore it, and the decision is audit-logged. No
// automated/AI moderation, spam detection, or fraud detection here.

export const reportReview = async (reporterId, reviewId, message) => {
  if (!message || !message.trim()) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'A reason is required to report a review.', true);
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Review not found', true);
  }

  return prisma.feedback.create({
    data: {
      userId: reporterId,
      type: 'Report',
      message: message.trim(),
      status: 'pending',
      reviewId,
    },
  });
};

/** Admin-facing: pending reports against reviews specifically (a subset of the
 * generic Feedback/Report queue), with the reported review's own content
 * included so an admin can actually see what's being reported. */
export const getReviewModerationQueue = async () => {
  return prisma.feedback.findMany({
    where: { type: 'Report', status: 'pending', reviewId: { not: null } },
    include: {
      review: {
        include: {
          businessProfile: { select: { id: true, businessName: true } },
          customer: { select: { name: true, customerName: true } },
        },
      },
      user: { select: { name: true, email: true, phoneNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export const hideReview = async (reviewId, actor = {}, reason) => {
  if (!reason || !reason.trim()) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'A reason is required to hide a review.', true);
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Review not found', true);
  }
  if (review.isHidden) {
    throw new AppError(StatusCodes.CONFLICT, 'This review is already hidden.', true);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { isHidden: true, hiddenReason: reason.trim(), hiddenAt: new Date() },
    });

    await refreshBusinessRating(tx, review.businessProfileId);

    // The moderation decision has been made — resolve any pending reports
    // against this review so they don't linger in the queue.
    await tx.feedback.updateMany({
      where: { reviewId, status: 'pending' },
      data: { status: 'resolved' },
    });

    await recordAuditLog(tx, {
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: 'REVIEW_HIDDEN',
      entityType: 'Review',
      entityId: reviewId,
      metadata: { reason: reason.trim() },
    });

    return updated;
  });
};

export const restoreReview = async (reviewId, actor = {}) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Review not found', true);
  }
  if (!review.isHidden) {
    throw new AppError(StatusCodes.CONFLICT, 'This review is not hidden.', true);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { isHidden: false, hiddenReason: null, hiddenAt: null },
    });

    await refreshBusinessRating(tx, review.businessProfileId);

    await recordAuditLog(tx, {
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: 'REVIEW_RESTORED',
      entityType: 'Review',
      entityId: reviewId,
    });

    return updated;
  });
};
