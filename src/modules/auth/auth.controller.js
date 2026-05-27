import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { requestOtp, verifyOtp } from '../../services/auth.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

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
