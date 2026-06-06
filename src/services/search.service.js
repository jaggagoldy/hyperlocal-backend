import prisma from '../config/prisma.js';

export const exploreVendors = async (citySlug, categorySlug, queryOptions = {}) => {
  const { query = '', page = 1, limit = 10, lat, lng, radius = 5, verifiedOnly, businessType, minRating, openNow } = queryOptions;

  const skip = (page - 1) * limit;
  const take = parseInt(limit, 10);

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

  const cityFilter = citySlug && citySlug !== 'any' ? { city: { slug: citySlug } } : {};
  const verificationFilter = verifiedOnly === 'true' || verifiedOnly === true ? { idVerified: true } : {};
  
  const businessTypeFilter = businessType ? { businessType: { in: businessType.split(',') } } : {};
  const ratingFilter = minRating ? { rating: { gte: parseFloat(minRating) } } : {};

  // For openNow we check if isOnline is true. (operatingHours logic can be complex in Prisma since it's JSON, but usually `isOnline` flag represents the current Open/Close status manually set by vendors or synced).
  const openNowFilter = openNow === 'true' || openNow === true ? { isOnline: true } : {};

  // Execute database-level pagination, sorting, and join
  const [vendors, totalCount] = await Promise.all([
    prisma.businessProfile.findMany({
      skip,
      take,
      where: {
        deletedAt: null,
        ...cityFilter,
        ...verificationFilter,
        ...businessTypeFilter,
        ...ratingFilter,
        ...openNowFilter,
        categories: categorySlug && categorySlug !== 'any' ? {
          some: {
            category: {
              slug: categorySlug,
            },
          },
        } : undefined,
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
        { isFeatured: 'desc' }, // Featured vendors pinned to the top
        { membershipTier: 'desc' }, // 'Starter', 'Pro', 'Free' (not perfect, but Prisma doesn't support custom sort array natively without Enums. We'll use desc for S > P > F, though P should be first. Ideally an Enum. We will stick to the schema and order).
        { status: 'asc' }, // 'available' comes first before 'busy', 'closed', etc.
        { rating: 'desc' },
      ],
    }),
    prisma.businessProfile.count({
      where: {
        deletedAt: null,
        ...cityFilter,
        ...verificationFilter,
        ...businessTypeFilter,
        ...ratingFilter,
        ...openNowFilter,
        categories: categorySlug && categorySlug !== 'any' ? { some: { category: { slug: categorySlug } } } : undefined,
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
    // 0. Featured Priority
    if (a.isFeatured !== b.isFeatured) {
      return a.isFeatured ? -1 : 1;
    }
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

  // Strict IST evaluation for Open Now
  let filteredData = sortedData;
  if (openNow === 'true' || openNow === true) {
    const istString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime = new Date(istString);
    const currentHour = istTime.getHours();
    const currentDayStr = istTime.toLocaleDateString("en-US", { weekday: 'long' }).toLowerCase();

    filteredData = sortedData.filter(vendor => {
      // 1. Manual Status Override
      if (vendor.status === 'closed' || !vendor.isOnline) return false;

      // 2. Evaluate Working Days
      if (vendor.workingDays) {
        const days = vendor.workingDays.toLowerCase();
        if (days !== 'all days' && days !== 'everyday' && days !== 'monday - sunday') {
           if (!days.includes(currentDayStr)) {
               return false;
           }
        }
      }

      // 3. Evaluate Time Availability (e.g. "9 AM - 6 PM")
      if (vendor.timeAvailability) {
        const match = vendor.timeAvailability.match(/(\d+)\s*(am|pm)\s*-\s*(\d+)\s*(am|pm)/i);
        if (match) {
          let startH = parseInt(match[1]);
          const startM = match[2].toLowerCase();
          let endH = parseInt(match[3]);
          const endM = match[4].toLowerCase();
          
          if (startM === 'pm' && startH !== 12) startH += 12;
          if (startM === 'am' && startH === 12) startH = 0;
          
          if (endM === 'pm' && endH !== 12) endH += 12;
          if (endM === 'am' && endH === 12) endH = 24; // If closing at 12 AM

          if (currentHour < startH || currentHour >= endH) {
            return false;
          }
        }
      }

      return true;
    });
  }

  return {
    data: filteredData,
    meta: {
      total: totalCount,
      page,
      limit: take,
      totalPages: Math.ceil(totalCount / take),
    },
  };
};
