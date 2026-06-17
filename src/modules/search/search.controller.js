import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { exploreVendors } from '../../services/search.service.js';
import { sendPaginated, sendSuccess } from '../../utils/responseHandler.js';
import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';
import { ENABLED_VERTICALS } from '../../config/env.js';

// Lightweight in-process TTL cache for rarely-changing metadata (cities/categories),
// which the frontend loads on every page view.
const metaCache = new Map();
const META_TTL_MS = 5 * 60 * 1000;
const getCached = async (key, loader) => {
  const hit = metaCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loader();
  metaCache.set(key, { value, expires: Date.now() + META_TTL_MS });
  return value;
};

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
        logger.error(err, 'Failed to log search deficit');
      });
  }

  sendPaginated(res, StatusCodes.OK, 'Vendors fetched successfully', result.data, result.meta);
});

export const getCitiesController = catchAsync(async (req, res) => {
  const cities = await getCached('cities', () =>
    prisma.city.findMany({ orderBy: { name: 'asc' } })
  );
  sendSuccess(res, StatusCodes.OK, 'Cities fetched successfully', cities);
});

// Maps each vertical (business type) to its top-level + sub category slugs.
const VERTICAL_CATEGORY_SLUGS = {
  FOOD_BEVERAGE: {
    top: ['food-dining', 'restaurant-cafe', 'food-beverage'],
    sub: ['restaurant', 'cloud-kitchen', 'street-food', 'bakery', 'mithai'],
  },
  SALON_BEAUTY: {
    top: ['salon-beauty', 'salon-spa', 'salon-booking'],
    sub: ['salon-booking-sub', 'haircut', 'massage', 'bridal-makeup', 'manicure', 'pedicure'],
  },
};

export const getCategoriesController = catchAsync(async (req, res) => {
  // Only surface categories for the currently live verticals.
  const topSlugs = [];
  const subSlugs = [];
  for (const vertical of ENABLED_VERTICALS) {
    const map = VERTICAL_CATEGORY_SLUGS[vertical];
    if (map) {
      topSlugs.push(...map.top);
      subSlugs.push(...map.sub);
    }
  }

  const categories = await getCached('categories', () =>
    prisma.category.findMany({
      where: { parentId: null, slug: { in: topSlugs } },
      include: {
        subcategories: {
          where: { slug: { in: subSlugs } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
  );
  sendSuccess(res, StatusCodes.OK, 'Categories fetched successfully', categories);
});
