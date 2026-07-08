import { StatusCodes } from 'http-status-codes';
import * as leadService from '../services/lead.service.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../errors/AppError.js';

export const getVendorLeads = catchAsync(async (req, res) => {
  // req.business is attached by verifyBusinessOwnership — never trust the raw
  // header/query value directly, it's attacker-controlled.
  const businessProfileId = req.business.id;

  const leads = await leadService.getVendorLeads(businessProfileId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: leads,
  });
});

export const updateLeadStatus = catchAsync(async (req, res) => {
  const businessProfileId = req.business.id;
  const { id } = req.params;

  const updatedLead = await leadService.updateLeadStatus(id, businessProfileId, req.body);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: updatedLead,
  });
});
