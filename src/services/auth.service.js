import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';

// Schemas
export const requestOtpSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format'),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format'),
  otpCode: z.string().length(6, 'OTP must be 6 digits'),
  sessionToken: z.string().min(1, 'Session token is required'),
});

// Helper: SHA-256 Hash
const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const requestOtp = async (phoneNumber) => {
  // Validate format
  const parsed = requestOtpSchema.safeParse({ phoneNumber });
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  // Generate 6-digit OTP (mocking 123456 for dev as per requirements)
  const otpCode = env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash OTP
  const otpHash = hashData(otpCode);
  
  // Generate a random session token
  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashData(rawSessionToken);

  // Expiration (10 mins)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Save OtpSession to DB
  await prisma.otpSession.create({
    data: {
      phoneNumber,
      otpHash,
      hashedToken,
      expiresAt,
    },
  });

  // Mock SMS Output via Pino logs
  logger.info({ phoneNumber, otpCode }, 'Mock SMS Sent');

  return {
    message: 'OTP sent successfully',
    sessionToken: rawSessionToken,
  };
};

export const verifyOtp = async (phoneNumber, otpCode, sessionToken) => {
  // Validate payload
  const parsed = verifyOtpSchema.safeParse({ phoneNumber, otpCode, sessionToken });
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const hashedToken = hashData(sessionToken);

  // Find valid session
  const session = await prisma.otpSession.findUnique({
    where: { hashedToken },
  });

  if (!session) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid or expired session', true);
  }

  if (session.phoneNumber !== phoneNumber) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Phone number mismatch', true);
  }

  if (session.isVerified) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'OTP already verified', true);
  }

  if (new Date() > session.expiresAt) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'OTP expired', true);
  }

  if (session.attempts >= 3) {
    throw new AppError(StatusCodes.TOO_MANY_REQUESTS, 'Maximum OTP attempts reached. Request a new OTP.', true);
  }

  const hashedInputOtp = hashData(otpCode);

  if (hashedInputOtp !== session.otpHash) {
    // Increment attempts
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid OTP code', true);
  }

  // Mark as verified
  await prisma.otpSession.update({
    where: { id: session.id },
    data: { isVerified: true },
  });

  // Upsert User Entity
  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: {},
    create: { phoneNumber },
  });

  // Issue secure 7-day JWT
  const jwtPayload = {
    id: user.id,
    phoneNumber: user.phoneNumber,
    role: user.role,
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    message: 'Authentication successful',
    token,
    user: jwtPayload,
  };
};
