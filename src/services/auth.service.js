import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import EmailService from '../services/email.service.js';

// ─── SCHEMAS ───────────────────────────────────────────────────────────────────

export const checkExistenceSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  context: z.enum(['customer', 'vendor', 'admin']).optional(),
});

export const emailLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(1, 'Password is required'),
  context: z.enum(['customer', 'vendor', 'admin']).default('customer'),
});

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
  message: 'Phone number is mandatory for service providers',
  path: ['phoneNumber'],
});

// ─── HELPERS ───────────────────────────────────────────────────────────────────

const hashData = (data) => crypto.createHash('sha256').update(data).digest('hex');

const BCRYPT_ROUNDS = 12;

// New password hashes use bcrypt. Legacy hashes are PBKDF2 stored as "salt:hexhash".
const hashPassword = async (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

// A legacy PBKDF2 hash looks like "<32-hex-salt>:<128-hex-hash>" and never starts with "$2".
const isLegacyHash = (stored) =>
  typeof stored === 'string' && stored.includes(':') && !stored.startsWith('$2');

// Constant-time verification for the legacy PBKDF2 format.
const verifyLegacyPassword = (password, storedPasswordHash) => {
  const [salt, hash] = storedPasswordHash.split(':');
  if (!salt || !hash) return false;
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(checkHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyPassword = async (password, storedPasswordHash) => {
  if (!storedPasswordHash) return false;
  if (isLegacyHash(storedPasswordHash)) {
    return verifyLegacyPassword(password, storedPasswordHash);
  }
  try {
    return await bcrypt.compare(password, storedPasswordHash);
  } catch {
    return false;
  }
};

/**
 * Resolve a single authoritative role for a user. `role` is the source of
 * truth; the profile-flag fallback keeps accounts created under the old
 * dual-profile model working until the backfill script runs.
 */
const resolveRole = (user) => {
  if (user.role === 'admin') return 'admin';
  if (user.role === 'vendor') return 'vendor';
  if (user.hasVendorProfile && !user.hasCustomerProfile) return 'vendor';
  return 'customer';
};

/**
 * Build the JWT payload. Single-role model: no context, no dual-profile wall.
 */
const buildJwtPayload = (user) => ({
  id: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: resolveRole(user),
  name: user.name,
  hasVendorProfile: !!user.hasVendorProfile,
  age: user.dateOfBirth ? Math.floor((new Date() - new Date(user.dateOfBirth)) / 31557600000) : undefined,
});

// ─── EXISTENCE CHECK ───────────────────────────────────────────────────────────

export const checkExistence = async (identifier, context = 'customer') => {
  const parsed = checkExistenceSchema.safeParse({ identifier, context });
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid identifier', true);
  }

  const isEmail = identifier.includes('@');
  let user;

  if (isEmail) {
    user = await prisma.user.findUnique({ where: { email: identifier } });
  } else {
    user = await prisma.user.findUnique({ where: { phoneNumber: identifier } });
  }

  if (user) {
    if (user.isBanned) {
      throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);
    }
    return {
      exists: true,
      authMethods: ['password'],
      hasCustomerProfile: user.hasCustomerProfile,
      hasVendorProfile: user.hasVendorProfile,
      role: user.role,
    };
  }

  return {
    exists: false,
    authMethods: ['password'],
    hasCustomerProfile: false,
    hasVendorProfile: false,
  };
};

// ─── EMAIL LOGIN ───────────────────────────────────────────────────────────────

export const emailLogin = async (data) => {
  const parsed = emailLoginSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes('@');
  let user;

  if (isEmail) {
    user = await prisma.user.findUnique({ where: { email: identifier } });
  } else {
    user = await prisma.user.findUnique({ where: { phoneNumber: identifier } });
  }

  if (!user || !user.passwordHash) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid credentials', true);
  }

  if (user.isBanned) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid email or password', true);
  }

  // Transparently upgrade legacy PBKDF2 hashes to bcrypt on successful login.
  if (isLegacyHash(user.passwordHash)) {
    try {
      const upgraded = await hashPassword(password);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
    } catch (err) {
      logger.error({ err }, 'Failed to upgrade legacy password hash');
    }
  }

  const jwtPayload = buildJwtPayload(user);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: 'Login successful', token, user: jwtPayload };
};

// ─── EMAIL REGISTER ────────────────────────────────────────────────────────────

export const emailRegister = async (data) => {
  const parsed = emailRegisterSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { email, password, name, role, phoneNumber } = parsed.data;

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new AppError(StatusCodes.CONFLICT, 'Email is already registered', true);

  let phoneVal = phoneNumber || null;
  if (phoneVal === '') phoneVal = null;
  if (phoneVal) {
    const existingPhone = await prisma.user.findUnique({ where: { phoneNumber: phoneVal } });
    if (existingPhone) throw new AppError(StatusCodes.CONFLICT, 'Phone number is already registered', true);
  }

  const passwordHash = await hashPassword(password);
  const isCustomer = role === 'customer';

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: isCustomer ? 'customer' : 'vendor', // single-role source of truth
      phoneNumber: phoneVal,
      // Flags retained for backward compatibility / future re-introduction.
      hasCustomerProfile: isCustomer,
      hasVendorProfile: !isCustomer,
    },
  });

  const jwtPayload = buildJwtPayload(user);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: 'Registration successful', token, user: jwtPayload };
};

// ─── FORGOT PASSWORD (email reset link) ───────────────────────────────────────

const GENERIC_RESET_RESPONSE = {
  message: 'If an account exists for that email, a password reset link has been sent.',
};

export const forgotPasswordService = async (email, baseUrl) => {
  // Basic email shape check; never reveal whether the account exists.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'A valid email address is required', true);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same response to prevent account enumeration.
  if (!user || user.isBanned) {
    return GENERIC_RESET_RESPONSE;
  }

  // Single-use, time-limited reset token. We store only its hash.
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashData(resetToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetOtp: tokenHash, passwordResetExpires: expiresAt },
  });

  const cleanBase = (baseUrl || '').replace(/\/$/, '');
  const resetUrl = `${cleanBase}/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;

  // Best-effort send; failures are logged but never leaked to the caller.
  await EmailService.sendPasswordResetEmail(email, user.name || 'there', resetUrl).catch((err) => {
    logger.error({ err, email }, 'Failed to send password reset email');
  });

  if (env.NODE_ENV === 'development') {
    logger.info({ email, resetUrl }, '[DEV] Password reset link generated');
  }

  return GENERIC_RESET_RESPONSE;
};

// ─── RESET PASSWORD (consume email link token) ────────────────────────────────

export const resetPasswordService = async (email, token, newPassword) => {
  if (!email || !token) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid or missing reset token', true);
  if (!newPassword || newPassword.length < 6) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Password must be at least 6 characters', true);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordResetOtp || !user.passwordResetExpires) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid or expired reset link', true);
  }
  if (new Date() > user.passwordResetExpires) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'This reset link has expired. Please request a new one.', true);
  }

  // Constant-time comparison of the token hashes.
  const providedHash = Buffer.from(hashData(token), 'hex');
  const storedHash = Buffer.from(user.passwordResetOtp, 'hex');
  const tokenValid =
    providedHash.length === storedHash.length && crypto.timingSafeEqual(providedHash, storedHash);
  if (!tokenValid) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired reset link', true);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetOtp: null, passwordResetExpires: null },
  });

  return { message: 'Password reset successful. You can now log in.' };
};
