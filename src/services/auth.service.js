import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import env from '../config/env.js';
import AppError from '../errors/AppError.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.util.js';
import firebaseAdmin from '../config/firebase.js';

// ─── SCHEMAS ───────────────────────────────────────────────────────────────────

export const verifyOtpSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID Token is required'),
  context: z.enum(['customer', 'vendor']).default('customer'),
});

export const checkExistenceSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  context: z.enum(['customer', 'vendor', 'admin']).optional(),
});

export const onboardSchema = z.object({
  onboardingToken: z.string().min(1, 'Onboarding token is required'),
  name: z.string().min(2, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional(),
  address: z.string().min(5, 'Address is required').optional(),
  gender: z.string().optional(),
  age: z.number().int().min(13).optional(),
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

/**
 * Build the JWT payload with dual-profile flags.
 * This is the single source of truth for token construction.
 */
const buildJwtPayload = (user, context) => ({
  id: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  name: user.name,
  context,
  hasCustomerProfile: user.hasCustomerProfile,
  hasVendorProfile: user.hasVendorProfile,
});

/**
 * Enforce the "Hard Wall": checks that the user actually has a profile
 * matching the requested context. Throws a structured 403 with a
 * machine-readable `code` so the frontend can show the right CTA.
 */
const enforceContextWall = (user, context) => {
  if (context === 'admin') {
    if (user.role !== 'admin') {
      throw new AppError(StatusCodes.FORBIDDEN, 'Access denied: Not an admin account.', true);
    }
    return; // admins bypass profile flags
  }

  if (context === 'customer' && !user.hasCustomerProfile) {
    const error = new AppError(
      StatusCodes.FORBIDDEN,
      'No consumer account found. Would you like to create one?',
      true
    );
    error.code = 'NO_CUSTOMER_PROFILE';
    error.hasVendorProfile = user.hasVendorProfile;
    throw error;
  }

  if (context === 'vendor' && !user.hasVendorProfile) {
    const error = new AppError(
      StatusCodes.FORBIDDEN,
      'No vendor account found. Would you like to register as a professional?',
      true
    );
    error.code = 'NO_VENDOR_PROFILE';
    error.hasCustomerProfile = user.hasCustomerProfile;
    throw error;
  }
};

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
      authMethods: user.passwordHash ? ['password', 'otp'] : ['otp'],
      hasCustomerProfile: user.hasCustomerProfile,
      hasVendorProfile: user.hasVendorProfile,
      role: user.role,
    };
  }

  return {
    exists: false,
    authMethods: ['otp'],
    hasCustomerProfile: false,
    hasVendorProfile: false,
  };
};

// ─── OTP VERIFY (Firebase) ─────────────────────────────────────────────────────

export const verifyOtp = async (idToken, context = 'customer') => {
  const parsed = verifyOtpSchema.safeParse({ idToken, context });
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const validatedContext = parsed.data.context;

  let decodedToken;
  try {
    decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
  } catch (error) {
    logger.error({ err: error }, 'Firebase ID token verification failed');
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired authentication token', true);
  }

  const rawPhoneNumber = decodedToken.phone_number;
  if (!rawPhoneNumber) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Phone number not found in authentication token', true);
  }

  // Normalize phone number (strip +91)
  let phoneNumber = rawPhoneNumber;
  if (phoneNumber.startsWith('+91')) {
    phoneNumber = phoneNumber.substring(3);
  } else if (phoneNumber.startsWith('+')) {
    // Other country codes not fully supported, but lets strip '+' for now if needed. 
    // Wait, regex expects 10 digits.
    throw new AppError(StatusCodes.BAD_REQUEST, 'Only Indian mobile numbers are supported', true);
  }

  const existingUser = await prisma.user.findUnique({ where: { phoneNumber } });

  if (existingUser) {
    if (existingUser.isBanned) throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);

    // Enforce the Hard Wall for OTP login
    enforceContextWall(existingUser, validatedContext);

    const jwtPayload = buildJwtPayload(existingUser, validatedContext);
    const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
    return { message: 'Authentication successful', token, user: jwtPayload, isNewUser: false };
  } else {
    // New user — issue onboarding token
    const onboardingPayload = { phoneNumber, context: validatedContext, verifiedAt: Date.now() };
    const onboardingToken = jwt.sign(onboardingPayload, env.JWT_SECRET, { expiresIn: '15m' });
    return { message: 'Phone verified. Please complete onboarding.', onboardingToken, isNewUser: true };
  }
};

// ─── ONBOARD USER (New Profile Creation) ──────────────────────────────────────

export const onboardUser = async (data) => {
  const parsed = onboardSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { onboardingToken, name, email, password, phoneNumber, address, gender, age } = parsed.data;

  let decoded;
  try {
    decoded = jwt.verify(onboardingToken, env.JWT_SECRET);
  } catch (error) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid or expired onboarding session. Please verify again.', true);
  }

  let finalPhoneNumber;
  let finalName;
  let finalEmail;
  let finalGoogleId = null;
  let passwordHash = null;

  if (decoded.isGoogle) {
    if (!phoneNumber) throw new AppError(StatusCodes.BAD_REQUEST, 'Phone number is required for Google onboarding', true);
    finalPhoneNumber = phoneNumber;
    finalName = decoded.name;
    finalEmail = decoded.email;
    finalGoogleId = decoded.googleId;
    if (password) passwordHash = hashPassword(password);
  } else {
    if (!name || !email || !password) throw new AppError(StatusCodes.BAD_REQUEST, 'Name, email, and password are required', true);
    finalPhoneNumber = decoded.phoneNumber;
    finalName = name;
    finalEmail = email;
    passwordHash = hashPassword(password);
  }

  const context = decoded.context;

  // Check if user already has a record (phone already in DB)
  let existingUser = await prisma.user.findUnique({ where: { phoneNumber: finalPhoneNumber } });

  // For Google users, we should also double check by email or googleId just in case
  if (!existingUser && finalEmail) {
    existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
  }

  if (existingUser) {
    // User exists — we're adding a secondary profile, NOT creating a new account.
    // Trust the onboardingToken (which was issued after OTP verification).
    if (context === 'customer' && existingUser.hasCustomerProfile) {
      throw new AppError(StatusCodes.CONFLICT, 'Consumer profile already exists for this account.', true);
    }
    if (context === 'vendor' && existingUser.hasVendorProfile) {
      throw new AppError(StatusCodes.CONFLICT, 'Vendor profile already exists for this account.', true);
    }

    const updateData =
      context === 'customer'
        ? {
            hasCustomerProfile: true,
            customerName: name,
            customerAddress: address,
            customerGender: gender,
            customerAge: age,
            // Also set top-level name/email if not already set
            name: existingUser.name || name,
            email: existingUser.email || email,
            passwordHash: existingUser.passwordHash || passwordHash,
          }
        : {
            hasVendorProfile: true,
            name: existingUser.name || finalName,
            email: existingUser.email || finalEmail,
            googleId: finalGoogleId || existingUser.googleId,
            passwordHash: passwordHash || existingUser.passwordHash,
          };

    const updatedUser = await prisma.user.update({ where: { id: existingUser.id }, data: updateData });

    const jwtPayload = buildJwtPayload(updatedUser, context);
    const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
    return { message: 'Profile created successfully', token, user: jwtPayload };
  }

  // Brand new user — create the record
  const isCustomer = context === 'customer';
  const user = await prisma.user.create({
    data: {
      phoneNumber: finalPhoneNumber,
      email: finalEmail,
      name: finalName,
      googleId: finalGoogleId,
      passwordHash,
      role: 'customer', // role is not used for routing anymore, only admin flag matters
      hasCustomerProfile: isCustomer,
      hasVendorProfile: !isCustomer,
      ...(isCustomer
        ? { customerName: finalName, customerAddress: address, customerGender: gender, customerAge: age }
        : {}),
    },
  });

  const jwtPayload = buildJwtPayload(user, context);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: 'Onboarding successful', token, user: jwtPayload };
};

// ─── ADD SECONDARY PROFILE (for authenticated users, no OTP required) ─────────

export const addSecondaryProfile = async (userId, targetContext, profileData = {}) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(StatusCodes.NOT_FOUND, 'User not found', true);
  if (user.isBanned) throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);

  if (targetContext === 'customer') {
    if (user.hasCustomerProfile) {
      throw new AppError(StatusCodes.CONFLICT, 'Consumer profile already exists.', true);
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        hasCustomerProfile: true,
        customerName: profileData.name || user.name,
        customerAddress: profileData.address,
        customerGender: profileData.gender,
        customerAge: profileData.age,
      },
    });
    const jwtPayload = buildJwtPayload(updatedUser, 'customer');
    const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
    return { message: 'Consumer profile created.', token, user: jwtPayload };
  }

  if (targetContext === 'vendor') {
    if (user.hasVendorProfile) {
      throw new AppError(StatusCodes.CONFLICT, 'Vendor profile already exists.', true);
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { hasVendorProfile: true },
    });
    const jwtPayload = buildJwtPayload(updatedUser, 'vendor');
    const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
    return { message: 'Vendor profile enabled.', token, user: jwtPayload };
  }

  throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid target context', true);
};

// ─── SWITCH CONTEXT (no logout needed for dual-profile users) ─────────────────

export const switchContext = async (userId, targetContext) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(StatusCodes.NOT_FOUND, 'User not found', true);
  if (user.isBanned) throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);

  enforceContextWall(user, targetContext);

  const jwtPayload = buildJwtPayload(user, targetContext);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: `Switched to ${targetContext} context`, token, user: jwtPayload };
};

// ─── EMAIL LOGIN ───────────────────────────────────────────────────────────────

export const emailLogin = async (data) => {
  const parsed = emailLoginSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || parsed.error.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { identifier, password, context } = parsed.data;
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

  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid email or password', true);
  }

  // Enforce the Hard Wall
  enforceContextWall(user, context);

  const jwtPayload = buildJwtPayload(user, context);
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

  const passwordHash = hashPassword(password);
  const isCustomer = role === 'customer';

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: 'customer', // role is only for admin differentiation
      phoneNumber: phoneVal,
      hasCustomerProfile: isCustomer,
      hasVendorProfile: !isCustomer,
    },
  });

  const context = data.context || (isCustomer ? 'customer' : 'vendor');
  const jwtPayload = buildJwtPayload(user, context);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: 'Registration successful', token, user: jwtPayload };
};

// ─── GOOGLE LOGIN ──────────────────────────────────────────────────────────────

export const googleLogin = async (data) => {
  const { code, context = 'customer' } = data;
  if (!code) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Auth code is required', true);
  }

  let googleProfile;
  try {
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'postmessage');
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    googleProfile = ticket.getPayload();
  } catch (error) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Failed to verify Google Auth Code', true);
  }

  const { sub: googleId, email, name } = googleProfile;
  if (!googleId || !email) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Incomplete Google profile', true);
  }

  let user = await prisma.user.findUnique({ where: { googleId } });

  if (user && user.isBanned) throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.isBanned) throw new AppError(StatusCodes.FORBIDDEN, 'Account Suspended', true);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, name: name || user.name },
      });
    }
  }

  // Existence Check Pivot
  if (!user || !user.phoneNumber) {
    // Return onboardingToken instead of creating record
    const onboardingPayload = { 
      googleId, 
      email, 
      name: name || email.split('@')[0], 
      context, 
      isGoogle: true, 
      verifiedAt: Date.now() 
    };
    const onboardingToken = jwt.sign(onboardingPayload, env.JWT_SECRET, { expiresIn: '15m' });
    return { 
      message: 'Google verified. Please complete onboarding with your phone number.', 
      onboardingToken, 
      isNewUser: true 
    };
  }

  enforceContextWall(user, context);

  const jwtPayload = buildJwtPayload(user, context);
  const token = jwt.sign(jwtPayload, env.JWT_SECRET, { expiresIn: '7d' });
  return { message: 'Google Authentication successful', token, user: jwtPayload };
};

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────

export const forgotPasswordService = async (phoneNumber) => {
  if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Indian mobile number format', true);
  }

  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user) throw new AppError(StatusCodes.NOT_FOUND, 'User with this phone number not found', true);

  const otpCode = env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = hashData(otpCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetOtp: otpHash, passwordResetExpires: expiresAt },
  });

  const message = `Your HyperLocal Go password reset OTP is ${otpCode}. It expires in 10 minutes.`;
  await sendWhatsAppNotification(phoneNumber, message).catch(err => {
    logger.error({ err, phoneNumber }, 'Failed to send WhatsApp OTP for password reset');
  });

  return { message: 'OTP sent to WhatsApp successfully' };
};

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────

export const resetPasswordService = async (phoneNumber, otpCode, newPassword) => {
  if (!/^[6-9]\d{9}$/.test(phoneNumber)) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Indian mobile number format', true);
  if (!otpCode || otpCode.length !== 6) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid OTP format', true);
  if (!newPassword || newPassword.length < 6) throw new AppError(StatusCodes.BAD_REQUEST, 'Password must be at least 6 characters', true);

  const user = await prisma.user.findUnique({ where: { phoneNumber } });
  if (!user || !user.passwordResetOtp || !user.passwordResetExpires) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid or expired OTP', true);
  }
  if (new Date() > user.passwordResetExpires) throw new AppError(StatusCodes.BAD_REQUEST, 'OTP has expired', true);

  const hashedInputOtp = hashData(otpCode);
  if (hashedInputOtp !== user.passwordResetOtp) throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid OTP', true);

  const passwordHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetOtp: null, passwordResetExpires: null },
  });

  return { message: 'Password reset successful. You can now login.' };
};
