import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';
import logger from '../config/logger.js';
import AppError from './AppError.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    if (error.code === 'P2002') {
      error = new AppError(StatusCodes.CONFLICT, 'Unique constraint failed');
    } else {
      error = new AppError(StatusCodes.BAD_REQUEST, 'Database request error');
    }
  }

  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    error = new AppError(statusCode, message, false, err.stack);
  }

  const { statusCode, message } = error;

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  if (env.NODE_ENV === 'development') {
    logger.error(error);
  } else {
    // Only log operational false in prod, or log all errors but hide stack from user
    logger.error({ err: error, reqId: req.id }, message);
  }

  res.status(statusCode).send(response);
};
