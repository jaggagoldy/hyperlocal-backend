import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import { REGIONS } from '../../config/regions.js';

// In-process cache: the region registry is static config, so compute once.
let cached = null;

export const getRegionsController = catchAsync(async (req, res) => {
  if (!cached) cached = { states: REGIONS };
  sendSuccess(res, StatusCodes.OK, 'Regions fetched successfully', cached);
});
