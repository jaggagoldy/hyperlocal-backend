import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  emailRegister, emailLogin,
  forgotPasswordService, resetPasswordService, checkExistence
} from '../../services/auth.service.js';
import prisma from '../../config/prisma.js';

export const checkExistenceController = catchAsync(async (req, res) => {
  const { identifier } = req.body;
  const result = await checkExistence(identifier);
  res.status(StatusCodes.OK).json({ status: 'success', data: result });
});

export const registerController = catchAsync(async (req, res) => {
  const result = await emailRegister(req.body);
  res.status(StatusCodes.CREATED).json({ status: 'success', data: result });
});

export const loginController = catchAsync(async (req, res) => {
  const payload = { ...req.body };
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

export const getMeController = catchAsync(async (req, res) => {
  const record = await prisma.user.findUnique({
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
      customerGender: true,
      customerAddress: true,
      businessProfiles: {
        take: 1,
        orderBy: { createdAt: 'asc' },
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

  const { businessProfiles, ...rest } = record;
  const vendor = businessProfiles?.[0] || null;
  // Resolve the authoritative single role (handles pre-backfill accounts).
  const role =
    rest.role === 'admin'
      ? 'admin'
      : rest.role === 'vendor' || vendor || rest.hasVendorProfile
        ? 'vendor'
        : 'customer';

  res.status(StatusCodes.OK).json({ status: 'success', data: { user: { ...rest, role, vendor } } });
});
