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

export const joinWaitlistController = catchAsync(async (req, res) => {
  const { vertical, name, contact, audience } = req.body;
  if (!vertical || !contact) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: 'vertical and contact are required',
    });
  }

  // Reuse the Feedback table as the demand-capture store (type='WAITLIST').
  const message = JSON.stringify({
    vertical,
    name: name || null,
    contact,
    audience: audience || 'customer', // 'customer' | 'vendor'
  });

  const entry = await prisma.feedback.create({
    data: { userId: req.user ? req.user.id : null, type: 'WAITLIST', message },
  });

  sendSuccess(res, StatusCodes.CREATED, "Thanks! We'll notify you when this launches.", { id: entry.id });
});

export const getFeedbackController = catchAsync(async (req, res) => {
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' },
  });
  
  sendSuccess(res, StatusCodes.OK, 'Feedbacks fetched successfully', feedbacks);
});
