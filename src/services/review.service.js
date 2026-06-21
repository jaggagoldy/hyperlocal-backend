import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

// NOTE: the public API param is named `vendorId` (kept stable for callers), but its
// value is a BusinessProfile id — both Review and OrderEnquiry key off
// `businessProfileId`, so we map it through here.
export const createReview = async (customerId, businessProfileId, rating, comment) => {
  // Verify the customer has a completed order with this business.
  const completedOrder = await prisma.orderEnquiry.findFirst({
    where: {
      customerId,
      businessProfileId,
      status: 'COMPLETED',
    },
  });

  if (!completedOrder) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You can only review businesses you have ordered from.');
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
        comment,
      },
    });

    const agg = await tx.review.aggregate({
      _avg: { rating: true },
      where: { businessProfileId },
    });

    await tx.businessProfile.update({
      where: { id: businessProfileId },
      data: { rating: agg._avg.rating ?? 0 },
    });

    return created;
  });

  return review;
};

export const getReviewsByVendor = async (businessProfileId) => {
  return await prisma.review.findMany({
    where: { businessProfileId },
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
