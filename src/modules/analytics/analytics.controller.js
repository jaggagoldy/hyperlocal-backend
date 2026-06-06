import { StatusCodes } from 'http-status-codes';
import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import AppError from '../../errors/AppError.js';

export const logInteractionController = (req, res) => {
  const { businessProfileId, type, metadata } = req.body;
  if (!businessProfileId || !type) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'businessProfileId and type are required', true);
  }

  // Fire 200 OK immediately
  sendSuccess(res, StatusCodes.OK, 'Interaction logged');

  // Background promise (fire-and-forget) to offload DB write
  Promise.resolve()
    .then(async () => {
      await prisma.leadAnalytic.create({
        data: {
          businessProfileId,
          type,
          metadata: metadata || {},
        },
      });
    })
    .catch((err) => {
      // Prevent unhandled promise rejections crashing the node process
      logger.error({ err, businessProfileId, type }, 'Background analytics write failed');
    });
};
