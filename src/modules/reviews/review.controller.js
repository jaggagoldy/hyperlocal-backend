import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { createReview, getReviewsByVendor, reportReview } from '../../services/review.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const submitReview = catchAsync(async (req, res) => {
  const { vendorId, rating, content, orderId } = req.body;
  const customerId = req.user.id; // from requireAuth

  const review = await createReview(customerId, vendorId, rating, content, orderId);
  sendSuccess(res, StatusCodes.CREATED, 'Review submitted successfully', review);
});

export const getVendorReviews = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const reviews = await getReviewsByVendor(vendorId);
  sendSuccess(res, StatusCodes.OK, 'Reviews fetched successfully', reviews);
});

// Sprint 2 Batch 5 — a customer can flag a specific review for moderation.
export const submitReviewReport = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const reporterId = req.user.id;

  const report = await reportReview(reporterId, id, message);
  sendSuccess(res, StatusCodes.CREATED, 'Review reported for moderation', report);
});
