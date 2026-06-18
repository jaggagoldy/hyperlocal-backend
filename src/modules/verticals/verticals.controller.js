import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import { ENABLED_VERTICALS } from '../../config/env.js';
import { listVerticals } from '../../config/verticals.js';

// In-process cache: the registry is static config, so compute once.
let cached = null;

export const getVerticalsController = catchAsync(async (req, res) => {
  if (!cached) cached = listVerticals(ENABLED_VERTICALS);
  sendSuccess(res, StatusCodes.OK, 'Verticals fetched successfully', cached);
});
