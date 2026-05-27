import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  getDashboardMetrics,
  registerLaunchCity,
  registerCategory,
  moderateVendorProfile,
  overrideVendorSubscription,
} from '../../services/admin.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const dashboardController = catchAsync(async (req, res) => {
  const metrics = await getDashboardMetrics();
  sendSuccess(res, StatusCodes.OK, 'Dashboard metrics fetched successfully', metrics);
});

export const createCityController = catchAsync(async (req, res) => {
  const { name, slug } = req.body;
  const city = await registerLaunchCity(name, slug);
  sendSuccess(res, StatusCodes.CREATED, 'City registered successfully', city);
});

export const createCategoryController = catchAsync(async (req, res) => {
  const { name, slug } = req.body;
  const category = await registerCategory(name, slug);
  sendSuccess(res, StatusCodes.CREATED, 'Category registered successfully', category);
});

export const moderateVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const vendor = await moderateVendorProfile(id, status);
  sendSuccess(res, StatusCodes.OK, 'Vendor profile moderated successfully', vendor);
});

export const subscriptionOverrideController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { tier, durationDays } = req.body;
  const result = await overrideVendorSubscription(id, tier, durationDays);
  sendSuccess(res, StatusCodes.OK, 'Subscription updated successfully', result);
});
