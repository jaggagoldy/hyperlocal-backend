import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';

export const getDashboardMetrics = async () => {
  // Vendor distribution states
  const vendorStatusDistribution = await prisma.businessProfile.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
  });

  // Lead Conversion Rates (profile_views vs clicks)
  const analyticCounts = await prisma.leadAnalytic.groupBy({
    by: ['type'],
    _count: {
      type: true,
    },
  });

  const views = analyticCounts.find((a) => a.type === 'profile_view')?._count.type || 0;
  const clicks = analyticCounts
    .filter((a) => a.type === 'call_click' || a.type === 'whatsapp_click')
    .reduce((sum, a) => sum + a._count.type, 0);
  
  const conversionRate = views > 0 ? ((clicks / views) * 100).toFixed(2) + '%' : '0%';

  // Top-performing domains (Categories)
  const topCategories = await prisma.businessCategory.groupBy({
    by: ['categoryId'],
    _count: {
      businessProfileId: true,
    },
    orderBy: {
      _count: {
        businessProfileId: 'desc',
      },
    },
    take: 5,
  });

  const categoryIds = topCategories.map((c) => c.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, slug: true },
  });

  const domains = topCategories.map((tc) => ({
    category: categories.find((c) => c.id === tc.categoryId),
    vendorCount: tc._count.businessProfileId,
  }));

  // Search Deficit Monitor
  const zeroResultSearches = await prisma.searchAnalytic.findMany({
    where: { resultsCount: 0 },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    vendorDistribution: vendorStatusDistribution.map((v) => ({
      status: v.status,
      count: v._count.status,
    })),
    leadMetrics: { views, clicks, conversionRate },
    topDomains: domains,
    searchDeficits: zeroResultSearches,
  };
};

export const registerLaunchCity = async (name, slug) => {
  return await prisma.city.create({
    data: { name, slug },
  });
};

export const registerCategory = async (name, slug) => {
  return await prisma.category.create({
    data: { name, slug },
  });
};

export const moderateVendorProfile = async (vendorId, status) => {
  const allowedStatuses = ['available', 'busy', 'closed', 'emergency', 'suspended', 'rejected'];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid status value', true);
  }

  return await prisma.businessProfile.update({
    where: { id: vendorId },
    data: { status },
  });
};

export const overrideVendorSubscription = async (vendorId, tier, durationDays) => {
  const allowedTiers = ['Free', 'Starter', 'Pro'];
  if (!allowedTiers.includes(tier)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid membership tier', true);
  }

  // Use transaction to ensure ranking updates atomically with subscription
  return await prisma.$transaction(async (tx) => {
    let expiresAt = null;
    if (durationDays && durationDays > 0) {
      expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    const subscription = await tx.businessSubscription.create({
      data: {
        businessProfileId: vendorId,
        tier,
        expiresAt,
        isActive: true,
      },
    });

    const business = await tx.businessProfile.update({
      where: { id: vendorId },
      data: { membershipTier: tier },
    });

    return { subscription, business };
  });
};

/**
 * Admin: paginated, filterable list of all BusinessProfiles.
 * Used by the admin moderation table — replaces the broken hardcoded
 * search-explore approach that only returned results for two specific cities.
 *
 * Filters: status, listingTier, isClaimed, page, limit (default 20, max 100)
 */
export const listAllBusinesses = async ({ status, listingTier, isClaimed, page = 1, limit = 20 } = {}) => {
  const safeLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);

  const where = { deletedAt: null };
  if (status) where.status = status;
  if (listingTier) where.listingTier = listingTier;
  if (isClaimed !== undefined && isClaimed !== '') {
    where.isClaimed = isClaimed === 'true' || isClaimed === true;
  }

  const [total, businesses] = await Promise.all([
    prisma.businessProfile.count({ where }),
    prisma.businessProfile.findMany({
      where,
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        city: { select: { id: true, name: true, slug: true, district: true, state: true } },
        categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        media: { take: 1, select: { id: true, secureUrl: true } },
        _count: { select: { catalogItems: true, reviews: true } },
      },
    }),
  ]);

  return {
    businesses,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};
