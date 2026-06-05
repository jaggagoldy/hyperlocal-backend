import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  createBusinessProfile,
  updateBusinessProfile,
  softDeleteBusinessProfile,
  registerBusinessSelf,
  getMyBusinesses,
  getBusinessDashboardData,
  getBusinessBySlug,
} from '../../services/business.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const getBusinessBySlugController = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const business = await getBusinessBySlug(slug);
  sendSuccess(res, StatusCodes.OK, 'Business fetched successfully', business);
});

export const createBusinessController = catchAsync(async (req, res) => {
  const business = await createBusinessProfile(req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Business created successfully', business);
});

export const updateBusinessController = catchAsync(async (req, res) => {
  // Use the business ID attached by verifyBusinessOwnership middleware
  const businessId = req.business.id;
  const business = await updateBusinessProfile(businessId, req.body);
  sendSuccess(res, StatusCodes.OK, 'Business updated successfully', business);
});

export const deleteBusinessController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await softDeleteBusinessProfile(id);
  sendSuccess(res, StatusCodes.OK, 'Business deleted successfully', result);
});

// Self-register a new business profile
export const registerBusinessSelfController = catchAsync(async (req, res) => {
  const business = await registerBusinessSelf(req.user.id, req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Business profile registered successfully', business);
});

// Retrieve all businesses for the logged in user
export const getMyBusinessesController = catchAsync(async (req, res) => {
  const businesses = await getMyBusinesses(req.user.id);
  sendSuccess(res, StatusCodes.OK, 'Businesses fetched successfully', businesses);
});

// Retrieve dashboard data for a specific business
export const getBusinessDashboardController = catchAsync(async (req, res) => {
  // Extract businessId attached by verifyBusinessOwnership middleware
  const businessId = req.business.id;
  const result = await getBusinessDashboardData(businessId);
  sendSuccess(res, StatusCodes.OK, 'Dashboard data fetched successfully', result);
});
