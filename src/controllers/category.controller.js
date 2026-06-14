import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import prisma from '../config/prisma.js';

export const getCategoriesController = catchAsync(async (req, res) => {
  const whereClause = {
    slug: {
      in: [
        'food-dining', 'restaurant-cafe', 'food-beverage', 'restaurant', 'cloud-kitchen', 'street-food',
        'salon-beauty', 'salon-spa', 'salon-booking-sub', 'salon-booking', 'haircut', 'massage', 'bridal-makeup'
      ]
    }
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
