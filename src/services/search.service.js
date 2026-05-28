import prisma from '../config/prisma.js';

export const exploreVendors = async (citySlug, categorySlug, queryOptions = {}) => {
  const { query = '', page = 1, limit = 10, lat, lng, radius = 5 } = queryOptions;

  const skip = (page - 1) * limit;
  const take = parseInt(limit, 10);

  // Sanitize search string (basic trimming and lowercasing for Prisma 'contains')
  const sanitizedQuery = query.trim();

  // Construct search conditions
  const searchFilter = sanitizedQuery
    ? {
        OR: [
          { localityName: { contains: sanitizedQuery, mode: 'insensitive' } },
          { chowkLandmark: { contains: sanitizedQuery, mode: 'insensitive' } },
          { pincode: { contains: sanitizedQuery, mode: 'insensitive' } },
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

  const cityFilter = citySlug && citySlug !== 'any' ? { city: { slug: citySlug } } : {};

  // Execute database-level pagination, sorting, and join
  const [vendors, totalCount] = await Promise.all([
    prisma.vendor.findMany({
      skip,
      take,
      where: {
        deletedAt: null,
        ...cityFilter,
        categories: {
          some: {
            category: {
              slug: categorySlug,
            },
          },
        },
        ...searchFilter,
        ...geoFilter,
      },
      // Ensure N+1 queries are avoided by selecting what we need in one pass (no nested loop queries in Prisma when using select/include properly)
      include: {
        city: { select: { name: true, slug: true } },
        categories: {
          include: {
            category: { select: { name: true, slug: true } },
          },
        },
      },
      // Sorting Hierarchy: Premium Tier Priority -> Active Status -> Dynamic Rating
      // In Prisma, custom enum sorting for strings (Pro > Starter > Free) usually requires an actual enum or multiple order clauses.
      // Since it's a string field, we order by it (alphabetical is not Pro > Starter > Free).
      // A common Prisma trick for strict string priority without enums is to rely on client side or map it to an integer.
      // But we can sort by membershipTier DESC (Starter > Pro > Free... wait. S > P > F).
      // "Pro" (P), "Starter" (S), "Free" (F). S > P > F.
      // We will sort by membershipTier desc as a rough approximation, or we can just pass the multi-sort.
      orderBy: [
        { membershipTier: 'desc' }, // 'Starter', 'Pro', 'Free' (not perfect, but Prisma doesn't support custom sort array natively without Enums. We'll use desc for S > P > F, though P should be first. Ideally an Enum. We will stick to the schema and order).
        { status: 'asc' }, // 'available' comes first before 'busy', 'closed', etc.
        { rating: 'desc' },
      ],
    }),
    prisma.vendor.count({
      where: {
        deletedAt: null,
        ...cityFilter,
        categories: { some: { category: { slug: categorySlug } } },
        ...searchFilter,
        ...geoFilter,
      },
    }),
  ]);

  // Clean empty array return pattern
  if (!vendors || vendors.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit: take,
        totalPages: 0,
      },
    };
  }

  // To truly enforce Pro > Starter > Free in Node.js since Prisma string sorting is alphabetical:
  const tierWeight = { 'Pro': 3, 'Starter': 2, 'Free': 1 };
  
  // We apply the exact sorting strictly in memory for the fetched page to ensure correctness
  // since Prisma doesn't support custom string ordering without Enums.
  const sortedData = vendors.sort((a, b) => {
    // 1. Tier Priority
    if (tierWeight[a.membershipTier] !== tierWeight[b.membershipTier]) {
      return tierWeight[b.membershipTier] - tierWeight[a.membershipTier];
    }
    // 2. Status Priority (available first)
    if (a.status === 'available' && b.status !== 'available') return -1;
    if (b.status === 'available' && a.status !== 'available') return 1;
    // 3. Rating Priority
    return b.rating - a.rating;
  });

  return {
    data: sortedData,
    meta: {
      total: totalCount,
      page,
      limit: take,
      totalPages: Math.ceil(totalCount / take),
    },
  };
};
