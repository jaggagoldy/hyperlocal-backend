import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { uploadVendorMedia, deleteVendorMedia } from '../../services/media.service.js';
import AppError from '../../errors/AppError.js';
import { sendSuccess } from '../../utils/responseHandler.js';

export const uploadMediaController = catchAsync(async (req, res) => {
  const { type } = req.body;
  // req.business is attached by verifyBusinessOwnership — the caller has already
  // been confirmed to own this business, so it's the only trustworthy source of
  // the vendor id (never the raw req.body.vendorId, which is attacker-controlled).
  const vendorId = req.business.id;

  if (!req.file) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'No file uploaded', true);
  }

  const result = await uploadVendorMedia(vendorId, type, req.file.buffer);

  sendSuccess(res, StatusCodes.CREATED, 'Media uploaded successfully', result);
});

export const deleteMediaController = catchAsync(async (req, res) => {
  const { mediaId } = req.body;
  const vendorId = req.business.id;

  if (!mediaId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'mediaId is required', true);
  }

  const result = await deleteVendorMedia(mediaId, vendorId);

  sendSuccess(res, StatusCodes.OK, 'Media deleted successfully', result);
});
