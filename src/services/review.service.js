import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

export const createReview = async (customerId, vendorId, rating, comment) => {
  // Verify the customer has a completed order with this vendor
  const completedOrder = await prisma.orderEnquiry.findFirst({
    where: {
      customerId,
      vendorId,
      status: 'COMPLETED'
    }
  });

  if (!completedOrder) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You can only review restaurants you have ordered from.');
  }

  const review = await prisma.review.create({
    data: {
      customerId,
      vendorId,
      orderId: completedOrder.id,
      rating,
      comment
    }
  });

  return review;
};

export const getReviewsByVendor = async (vendorId) => {
  return await prisma.review.findMany({
    where: { vendorId },
    include: {
      customer: {
        select: {
          name: true,
          customerName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};
