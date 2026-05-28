import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { exploreVendors } from '../../services/search.service.js';
import { sendPaginated, sendSuccess } from '../../utils/responseHandler.js';
import prisma from '../../config/prisma.js';

export const exploreVendorsController = catchAsync(async (req, res) => {
  const { citySlug, categorySlug } = req.params;
  const result = await exploreVendors(citySlug, categorySlug, req.query);
  
  // Background search deficit logging
  if (result.meta.total === 0) {
    Promise.resolve()
      .then(async () => {
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
        const { default: logger } = import('../../config/logger.js');
        logger.error(err, 'Failed to log search deficit');
      });
  }

  sendPaginated(res, StatusCodes.OK, 'Vendors fetched successfully', result.data, result.meta);
});

export const getCitiesController = catchAsync(async (req, res) => {
  const cities = await prisma.city.findMany({
    orderBy: { name: 'asc' },
  });
  sendSuccess(res, StatusCodes.OK, 'Cities fetched successfully', cities);
});

export const getCategoriesController = catchAsync(async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  sendSuccess(res, StatusCodes.OK, 'Categories fetched successfully', categories);
});
