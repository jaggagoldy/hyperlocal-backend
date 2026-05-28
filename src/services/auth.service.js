import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.util.js';

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

  // Generate 6-digit OTP (mocking 111111 for dev as per requirements)
  const otpCode = env.NODE_ENV === 'development' ? '111111' : Math.floor(100000 + Math.random() * 900000).toString();
  
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

// Password Hashing helpers using native Node.js crypto
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedPasswordHash) => {
  if (!storedPasswordHash) return false;
  const [salt, hash] = storedPasswordHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
};

// Schemas for Email Registration and Login
export const emailRegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['customer', 'vendor']).default('customer'),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format').optional().or(z.literal('')),
}).refine((data) => {
  if (data.role === 'vendor') {
    return !!data.phoneNumber && data.phoneNumber.length === 10;
  }
  return true;
}, {
  message: "Phone number is mandatory for service providers",
  path: ["phoneNumber"]
});

export const emailLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Email Register Service
export const emailRegister = async (data) => {
  const parsed = emailRegisterSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { email, password, name, role, phoneNumber } = parsed.data;

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new AppError(StatusCodes.CONFLICT, 'Email is already registered', true);
  }

  // Check if phoneNumber already exists if provided
  let phoneVal = phoneNumber || null;
  if (phoneVal === '') phoneVal = null;
  if (phoneVal) {
    const existingPhone = await prisma.user.findUnique({ where: { phoneNumber: phoneVal } });
    if (existingPhone) {
      throw new AppError(StatusCodes.CONFLICT, 'Phone number is already registered', true);
    }
  }

  const passwordHash = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      phoneNumber: phoneVal,
    },
  });

  const jwtPayload = {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    name: user.name,
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    message: 'Registration successful',
    token,
    user: jwtPayload,
  };
};

// Email Login Service
export const emailLogin = async (data) => {
  const parsed = emailLoginSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid email or password', true);
  }

  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid email or password', true);
  }

  const jwtPayload = {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    name: user.name,
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    message: 'Login successful',
    token,
    user: jwtPayload,
  };
};

// Google Login/Signup Service
export const googleLogin = async (data) => {
  const { googleId, email, name, role = 'customer' } = data;
  if (!googleId || !email) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'googleId and email are required', true);
  }

  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    // Check if email already exists
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Link googleId to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, name: name || user.name },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          name: name || email.split('@')[0],
          role,
        },
      });
    }
  }

  const jwtPayload = {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    name: user.name,
  };

  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });

  return {
    message: 'Google Authentication successful',
    token,
    user: jwtPayload,
  };
};

// Forgot Password Service
export const forgotPasswordService = async (phoneNumber) => {
  if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Indian mobile number format', true);
  }

  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User with this phone number not found', true);
  }

  // Generate 6-digit OTP
  const otpCode = env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashData(otpCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetOtp: otpHash,
      passwordResetExpires: expiresAt,
    },
  });

  const message = `Your HyperLocal Go password reset OTP is ${otpCode}. It expires in 10 minutes.`;
  await sendWhatsAppNotification(phoneNumber, message).catch(err => {
    logger.error({ err, phoneNumber }, 'Failed to send WhatsApp OTP for password reset');
  });

  return { message: 'OTP sent to WhatsApp successfully' };
};

// Reset Password Service
export const resetPasswordService = async (phoneNumber, otpCode, newPassword) => {
  if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Indian mobile number format', true);
  }
  if (!otpCode || otpCode.length !== 6) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid OTP format', true);
  }
  if (!newPassword || newPassword.length < 6) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Password must be at least 6 characters', true);
  }

  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user || !user.passwordResetOtp || !user.passwordResetExpires) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid or expired OTP', true);
  }

  if (new Date() > user.passwordResetExpires) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'OTP has expired', true);
  }

  const hashedInputOtp = hashData(otpCode);
  if (hashedInputOtp !== user.passwordResetOtp) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid OTP', true);
  }

  const passwordHash = hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetOtp: null,
      passwordResetExpires: null,
    },
  });

  return { message: 'Password reset successful. You can now login.' };
};

