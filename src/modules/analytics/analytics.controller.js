import { StatusCodes } from 'http-status-codes';
import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import AppError from '../../errors/AppError.js';

export const logInteractionController = (req, res) => {
  const { vendorId, type, metadata } = req.body;
  if (!vendorId || !type) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'vendorId and type are required', true);
  }

  // Fire 200 OK immediately
  sendSuccess(res, StatusCodes.OK, 'Interaction logged');

  // Background promise (fire-and-forget) to offload DB write
  Promise.resolve()
    .then(async () => {
      await prisma.leadAnalytic.create({
        data: {
          vendorId,
          type,
          metadata: metadata || {},
        },
      });
    })
    .catch((err) => {
      // Prevent unhandled promise rejections crashing the node process
      logger.error({ err, vendorId, type }, 'Background analytics write failed');
    });
};
