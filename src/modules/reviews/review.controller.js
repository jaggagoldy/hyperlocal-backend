import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { createReview, getReviewsByVendor } from '../../services/review.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const submitReview = catchAsync(async (req, res) => {
  const { vendorId, rating, content } = req.body;
  const customerId = req.user.id; // from requireAuth

  const review = await createReview(customerId, vendorId, rating, content);
  sendSuccess(res, StatusCodes.CREATED, 'Review submitted successfully', review);
});

export const getVendorReviews = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const reviews = await getReviewsByVendor(vendorId);
  sendSuccess(res, StatusCodes.OK, 'Reviews fetched successfully', reviews);
});
