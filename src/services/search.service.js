import prisma from '../config/prisma.js';
import { ENABLED_VERTICALS } from '../config/env.js';

export const exploreVendors = async (citySlug, categorySlug, queryOptions = {}) => {
  const { query = '', lat, lng, radius = 5, verifiedOnly, businessType, minRating, openNow, state, district } = queryOptions;

  const page = Math.max(1, parseInt(queryOptions.page, 10) || 1);
  const take = Math.min(50, Math.max(1, parseInt(queryOptions.limit, 10) || 10));
  const skip = (page - 1) * take;

  // Sanitize search string (basic trimming and lowercasing for Prisma 'contains')
  const sanitizedQuery = query.trim();

  // Construct search conditions
  const searchFilter = sanitizedQuery
    ? {
        OR: [
          { businessName: { contains: sanitizedQuery, mode: 'insensitive' } },
          { localityName: { contains: sanitizedQuery, mode: 'insensitive' } },
          { chowkLandmark: { contains: sanitizedQuery, mode: 'insensitive' } },
          { pincode: { contains: sanitizedQuery, mode: 'insensitive' } },
          { catalogItems: { some: { title: { contains: sanitizedQuery, mode: 'insensitive' } } } },
          { catalogItems: { some: { description: { contains: sanitizedQuery, mode: 'insensitive' } } } },
        ],
      }
    : {};

  let geoFilter = {};
  if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius);
    const latDelta = radiusNum / 111.32;
    const lngDelta = radiusNum / (111.32 * Math.cos(latNum * (Math.PI / 180)));
    
    geoFilter = {
      latitude: {
        gte: latNum - latDelta,
        lte: latNum + latDelta,
      },
      longitude: {
        gte: lngNum - lngDelta,
        lte: lngNum + lngDelta,
      }
    };
  }

  // Location scope: a specific city slug, else a state/district scope (proximity-first,
  // but widenable). State defaults are applied by the caller/UI; here we just honor inputs.
  let locationFilter = {};
  if (citySlug && citySlug !== 'any') {
    locationFilter = { city: { slug: citySlug } };
  } else if (state || district) {
    locationFilter = {
      city: {
        ...(state ? { state } : {}),
        ...(district ? { district } : {}),
      },
    };
  }

  const verificationFilter = verifiedOnly === 'true' || verifiedOnly === true ? { idVerified: true } : {};

  // Vertical gate: restrict to the configured live verticals, intersected with any request.
  let allowedTypes = ENABLED_VERTICALS;
  if (businessType) {
    const requested = businessType.split(',').map((t) => t.trim().toUpperCase());
    const intersection = requested.filter((t) => ENABLED_VERTICALS.includes(t));
    if (intersection.length > 0) allowedTypes = intersection;
  }
  const businessTypeFilter = { businessType: { in: allowedTypes } };

  const ratingFilter = minRating ? { rating: { gte: parseFloat(minRating) } } : {};

  // "Open now" maps to the vendor's manual online toggle. Doing it in the DB keeps
  // pagination counts correct (the old in-memory hour-string parsing corrupted them).
  const openNowFilter = openNow === 'true' || openNow === true ? { isOnline: true } : {};

  const where = {
    deletedAt: null,
    ...locationFilter,
    ...verificationFilter,
    ...businessTypeFilter,
    ...ratingFilter,
    ...openNowFilter,
    categories:
      categorySlug && categorySlug !== 'any'
        ? { some: { category: { slug: categorySlug } } }
        : undefined,
    ...searchFilter,
    ...geoFilter,
  };

  // All ordering done in the DB so pagination is correct across pages.
  // No paid tiers: featured (free editorial pin) → rating → recency.
  const [vendors, totalCount] = await Promise.all([
    prisma.businessProfile.findMany({
      skip,
      take,
      where,
      include: {
        city: { select: { name: true, slug: true, state: true, district: true } },
        categories: {
          include: { category: { select: { name: true, slug: true } } },
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { rating: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.businessProfile.count({ where }),
  ]);

  return {
    data: vendors,
    meta: {
      total: totalCount,
      page,
      limit: take,
      totalPages: Math.ceil(totalCount / take),
    },
  };
};
