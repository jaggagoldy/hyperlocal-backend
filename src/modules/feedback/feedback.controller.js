import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import prisma from '../../config/prisma.js';

export const submitFeedbackController = catchAsync(async (req, res) => {
  const { type, message } = req.body;
  const userId = req.user ? req.user.id : null;

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      type,
      message,
    }
  });

  sendSuccess(res, StatusCodes.CREATED, 'Feedback submitted successfully', feedback);
});

export const getFeedbackController = catchAsync(async (req, res) => {
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  sendSuccess(res, StatusCodes.OK, 'Feedbacks fetched successfully', feedbacks);
});
