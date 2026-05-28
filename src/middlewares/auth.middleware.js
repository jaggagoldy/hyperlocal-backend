import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import prisma from '../config/prisma.js';

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
    
    // Verify user still exists and fetch their real-time role and vendorId
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { vendor: true }
    });
    if (!user) {
      return next(new AppError(StatusCodes.UNAUTHORIZED, 'The user belonging to this token no longer exists.', true));
    }

    req.user = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      vendorId: user.vendor?.id || null
    };
    next();
  } catch (error) {
    return next(new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token.', true));
  }
});

export const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // ignore token errors for optional auth
    }
  }
  
  next();
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
  max: env.NODE_ENV === 'development' ? 1000 : 5, // Unlimited in dev
  message: {
    code: StatusCodes.TOO_MANY_REQUESTS,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development', // Completely skip in dev
});
