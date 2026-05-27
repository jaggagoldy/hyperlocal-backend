import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { createVendor, updateVendor, softDeleteVendor } from '../../services/vendor.service.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const createVendorController = catchAsync(async (req, res) => {
  const vendor = await createVendor(req.body);
  sendSuccess(res, StatusCodes.CREATED, 'Vendor created successfully', vendor);
});

export const updateVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const vendor = await updateVendor(id, req.body);
  sendSuccess(res, StatusCodes.OK, 'Vendor updated successfully', vendor);
});

export const deleteVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await softDeleteVendor(id);
  sendSuccess(res, StatusCodes.OK, 'Vendor deleted successfully', result);
});
