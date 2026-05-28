import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { requestOtp, verifyOtp, emailRegister, emailLogin, googleLogin, forgotPasswordService, resetPasswordService } from '../../services/auth.service.js';
import prisma from '../../config/prisma.js';

export const requestOtpController = catchAsync(async (req, res) => {
  const result = await requestOtp(req.body.phoneNumber);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
});

export const verifyOtpController = catchAsync(async (req, res) => {
  const { phoneNumber, otpCode, sessionToken } = req.body;
  const result = await verifyOtp(phoneNumber, otpCode, sessionToken);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
});

export const registerController = catchAsync(async (req, res) => {
  const result = await emailRegister(req.body);
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: result,
  });
});

export const loginController = catchAsync(async (req, res) => {
  const result = await emailLogin(req.body);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
});

export const googleLoginController = catchAsync(async (req, res) => {
  const result = await googleLogin(req.body);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
});

export const forgotPasswordController = catchAsync(async (req, res) => {
  const result = await forgotPasswordService(req.body.phoneNumber);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
});

export const resetPasswordController = catchAsync(async (req, res) => {
  const { phoneNumber, otpCode, newPassword } = req.body;
  const result = await resetPasswordService(phoneNumber, otpCode, newPassword);
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result,
  });
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
      dateOfBirth: true,
      gender: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
          slug: true,
          status: true,
          membershipTier: true,
        },
      },
    },
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { user },
  });
});
