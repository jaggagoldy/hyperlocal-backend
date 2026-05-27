import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { exploreVendors } from '../../services/search.service.js';
import { sendPaginated } from '../../utils/responseHandler.js';

export const exploreVendorsController = catchAsync(async (req, res) => {
  const { citySlug, categorySlug } = req.params;
  const result = await exploreVendors(citySlug, categorySlug, req.query);
  
  // Background search deficit logging
  if (result.meta.total === 0) {
    Promise.resolve()
      .then(async () => {
        const { default: prisma } = await import('../../config/prisma.js');
        await prisma.searchAnalytic.create({
          data: {
            citySlug,
            categorySlug,
            query: req.query.query || '',
            resultsCount: 0,
          },
        });
      })
      .catch((err) => {
        const { default: logger } = require('../../config/logger.js');
        logger.error(err, 'Failed to log search deficit');
      });
  }

  sendPaginated(res, StatusCodes.OK, 'Vendors fetched successfully', result.data, result.meta);
});
