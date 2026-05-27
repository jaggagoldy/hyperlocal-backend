import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const requireAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError(StatusCodes.UNAUTHORIZED, 'You are not logged in. Please provide a token.', true));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token.', true));
  }
});

export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action.', true));
    }
    next();
  };
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window`
  message: {
    code: StatusCodes.TOO_MANY_REQUESTS,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
