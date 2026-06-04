import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import {
  createVendor,
  updateVendor,
  softDeleteVendor,
  registerVendorSelf,
  getVendorProfileByUserId,
  getVendorBySlug,
} from '../../services/vendor.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const getVendorBySlugController = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const vendor = await getVendorBySlug(slug);
  sendSuccess(res, StatusCodes.OK, 'Vendor fetched successfully', vendor);
});

export const createVendorController = catchAsync(async (req, res) => {
  const vendor = await createVendor(req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Vendor created successfully', vendor);
});

export const updateVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  // Admin can update any, vendor user can only update theirs (this check is verified in routes / user match)
  const vendor = await updateVendor(id, req.body);
  sendSuccess(res, StatusCodes.OK, 'Vendor updated successfully', vendor);
});

export const deleteVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await softDeleteVendor(id);
  sendSuccess(res, StatusCodes.OK, 'Vendor deleted successfully', result);
});

// Self-register a vendor profile
export const registerVendorSelfController = catchAsync(async (req, res) => {
  const vendor = await registerVendorSelf(req.user.id, req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Vendor profile registered successfully', vendor);
});

// Retrieve logged-in vendor's own profile and analytics
export const getMyVendorProfileController = catchAsync(async (req, res) => {
  const result = await getVendorProfileByUserId(req.user.id);
  sendSuccess(res, StatusCodes.OK, 'Vendor profile fetched successfully', result);
});
