import prisma from '../config/prisma.js';
import { ENABLED_VERTICALS } from '../config/env.js';
import { districtBySlug } from '../config/regions.js';
import { VERTICALS } from '../config/verticals.js';
import { rankResults } from './ranking.service.js';

const ALL_VERTICAL_KEYS = Object.keys(VERTICALS);

// Sort strategies for the discovery results page. 'relevance' (default) runs the
// extensible ranking pipeline; the others are direct, single-signal DB-level
// sorts a customer might explicitly ask for. Adding a new option here is a
// one-line change — no ranking.service.js or controller change needed.
const SORT_OPTIONS = {
  relevance: [{ isFeatured: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
  rating: [{ rating: 'desc' }, { createdAt: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  open_now: [{ isOnline: 'desc' }, { isFeatured: 'desc' }, { rating: 'desc' }],
};

export const exploreVendors = async (citySlug, categorySlug, queryOptions = {}) => {
  const { query = '', lat, lng, radius = 5, verifiedOnly, businessType, minRating, openNow, state, district, scope, sortBy } = queryOptions;
  const orderBy = SORT_OPTIONS[sortBy] || SORT_OPTIONS.relevance;

  // Directory scope (Phase F): the consumer directory pages (/[district]/[category])
  // browse the FULL supply — including unclaimed OSM stubs in not-yet-live verticals —
  // so they are NOT restricted to ENABLED_VERTICALS. The default (transactional) scope
  // stays gated, so live pages like /food only ever see enabled verticals.
  const isDirectory = scope === 'directory';

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
          { user: { name: { contains: sanitizedQuery, mode: 'insensitive' } } },
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
    // A citySlug that is a canonical district slug filters by the whole district
    // (so every city within it — including legacy free-text cities — surfaces);
    // any other slug stays an exact single-city match.
    const canonical = districtBySlug(citySlug);
    locationFilter = canonical
      ? { city: { district: canonical.name } }
      : { city: { slug: citySlug } };
  } else if (state || district) {
    locationFilter = {
      city: {
        ...(state ? { state } : {}),
        ...(district ? { district } : {}),
      },
    };
  }

  const verificationFilter = verifiedOnly === 'true' || verifiedOnly === true ? { idVerified: true } : {};

  // Vertical gate. Transactional scope restricts to live verticals (ENABLED_VERTICALS);
  // directory scope allows every known vertical so unclaimed stubs in coming-soon
  // verticals still surface on the directory pages. A businessType request narrows
  // within whichever set applies.
  const baseTypes = isDirectory ? ALL_VERTICAL_KEYS : ENABLED_VERTICALS;
  let allowedTypes = baseTypes;
  if (businessType) {
    const requested = businessType.split(',').map((t) => t.trim().toUpperCase());
    const intersection = requested.filter((t) => baseTypes.includes(t));
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

  // Primary sort is done in the DB (so pagination/counts stay correct across
  // pages); the 'relevance' strategy additionally re-ranks the returned page
  // in-memory via the ranking pipeline (see ranking.service.js) so the DB's
  // featured→rating→recency ordering gets refined by trust/completeness/open-now
  // signals without needing a SQL-level scoring expression.
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
        media: { select: { type: true, secureUrl: true } },
        _count: { select: { reviews: true, catalogItems: true } },
      },
      orderBy,
    }),
    prisma.businessProfile.count({ where }),
  ]);

  const results = (!sortBy || sortBy === 'relevance') ? rankResults(vendors) : vendors;

  return {
    data: results,
    meta: {
      total: totalCount,
      page,
      limit: take,
      totalPages: Math.ceil(totalCount / take),
    },
  };
};
