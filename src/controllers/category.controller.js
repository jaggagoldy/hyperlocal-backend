import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import prisma from '../config/prisma.js';
import { ENABLED_VERTICALS } from '../config/env.js';
import { enabledCategorySlugs } from '../config/verticals.js';

export const getCategoriesController = catchAsync(async (req, res) => {
  // Only surface categories belonging to currently live verticals.
  const whereClause = {
    slug: { in: enabledCategorySlugs(ENABLED_VERTICALS) },
  };

  const categories = await prisma.category.findMany({
    where: whereClause,
    orderBy: { name: 'asc' },
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: categories,
  });
});
