import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import * as userService from '../../services/user.service.js';

export const updateProfileController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const updatedUser = await userService.updateProfile(userId, req.body);
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: updatedUser
  });
});

export const changePasswordController = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await userService.changePassword(userId, req.body);
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: result.message
  });
});
