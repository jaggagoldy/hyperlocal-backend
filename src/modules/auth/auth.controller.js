import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  emailRegister, emailLogin,
  forgotPasswordService, resetPasswordService, checkExistence,
  switchContext, addSecondaryProfile
} from '../../services/auth.service.js';
import prisma from '../../config/prisma.js';

export const checkExistenceController = catchAsync(async (req, res) => {
  const { identifier, context } = req.body;
  const result = await checkExistence(identifier, context);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

export const registerController = catchAsync(async (req, res) => {
  const result = await emailRegister({ ...req.body, context: req.body.context || 'customer' });
  res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
});

export const loginController = catchAsync(async (req, res) => {
  const payload = { ...req.body, context: req.body.context || 'customer' };
  // Backwards compat: map legacy `email` field to `identifier`
  if (payload.email && !payload.identifier) {
    payload.identifier = payload.email;
  }
  const result = await emailLogin(payload);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

export const forgotPasswordController = catchAsync(async (req, res) => {
  // Build the reset link base from an explicit env override or the incoming request.
  const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  const result = await forgotPasswordService(req.body.email, baseUrl);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

export const resetPasswordController = catchAsync(async (req, res) => {
  const { email, token, newPassword, password } = req.body;
  const result = await resetPasswordService(email, token, newPassword || password);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

/**
 * POST /auth/switch-context
 * Allows a dual-profile user to swap JWT context without logging out.
 * Body: { targetContext: 'customer' | 'vendor' }
 */
export const switchContextController = catchAsync(async (req, res) => {
  const { targetContext } = req.body;
  if (!targetContext || !['customer', 'vendor'].includes(targetContext)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: 'targetContext must be "customer" or "vendor"',
    });
  }
  const result = await switchContext(req.user.id, targetContext);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

/**
 * POST /auth/add-profile
 * Authenticated user adds a secondary profile without re-doing OTP.
 * Body: { targetContext: 'customer' | 'vendor', name?, address?, gender?, age? }
 */
export const addSecondaryProfileController = catchAsync(async (req, res) => {
  const { targetContext, ...profileData } = req.body;
  if (!targetContext || !['customer', 'vendor'].includes(targetContext)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'fail',
      message: 'targetContext must be "customer" or "vendor"',
    });
  }
  const result = await addSecondaryProfile(req.user.id, targetContext, profileData);
  res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
});

export const getMeController = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      name: true,
      role: true,
      hasCustomerProfile: true,
      hasVendorProfile: true,
      customerName: true,
      customerAge: true,
      customerGender: true,
      customerAddress: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
          slug: true,
          status: true,
          membershipTier: true,
          isFeatured: true,
        },
      },
    },
  });

  res.status(StatusCodes.OK).json({ status: 'success', data: { user } });
});
