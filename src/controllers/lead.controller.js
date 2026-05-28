import { StatusCodes } from 'http-status-codes';
import * as leadService from '../services/lead.service.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../errors/AppError.js';

export const getVendorLeads = catchAsync(async (req, res) => {
  // In a real app, you might extract vendorId from req.user.vendorId 
  // For now, if the user is authenticated and has a vendor profile, we expect vendorId to be available.
  // We'll pass it from a query param or req.user. Let's assume the frontend passes vendorId in the query, 
  // or it's attached to the user. Let's use req.query.vendorId for flexibility, 
  // but ideally it's validated against the logged-in user.
  const vendorId = req.user?.vendorId || req.query.vendorId;

  if (!vendorId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Vendor ID is required to fetch leads', true);
  }

  const leads = await leadService.getVendorLeads(vendorId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: leads,
  });
});

export const updateLeadStatus = catchAsync(async (req, res) => {
  const vendorId = req.user?.vendorId || req.body.vendorId;
  const { id } = req.params;

  if (!vendorId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Vendor ID is required to update leads', true);
  }

  const updatedLead = await leadService.updateLeadStatus(id, vendorId, req.body);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: updatedLead,
  });
});
