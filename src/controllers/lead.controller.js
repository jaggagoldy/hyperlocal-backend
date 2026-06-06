import { StatusCodes } from 'http-status-codes';
import * as leadService from '../services/lead.service.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../errors/AppError.js';

export const getVendorLeads = catchAsync(async (req, res) => {
  const businessProfileId = req.headers['x-business-id'] || req.query.businessId;

  if (!businessProfileId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Business ID is required to fetch leads', true);
  }

  const leads = await leadService.getVendorLeads(businessProfileId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: leads,
  });
});

export const updateLeadStatus = catchAsync(async (req, res) => {
  const businessProfileId = req.headers['x-business-id'] || req.body.businessId;
  const { id } = req.params;

  if (!businessProfileId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Business ID is required to update leads', true);
  }

  const updatedLead = await leadService.updateLeadStatus(id, businessProfileId, req.body);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: updatedLead,
  });
});
