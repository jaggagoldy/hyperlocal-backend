import { StatusCodes } from 'http-status-codes';

export const validate = (schema) => (req, res, next) => {
  const parseResult = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!parseResult.success) {
    const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: `Validation failed: ${errors}`,
    });
  }

  // Assign back validated and transformed data
  req.body = parseResult.data.body;
  req.query = parseResult.data.query;
  req.params = parseResult.data.params;

  next();
};
