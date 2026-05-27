export const sendSuccess = (res, statusCode, message, data = null) => {
  res.status(statusCode).json({
    status: 'success',
    message,
    ...(data !== null && { data }),
  });
};

export const sendPaginated = (res, statusCode, message, data, meta) => {
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
    meta,
  });
};
