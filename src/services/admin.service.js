import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';

export const getDashboardMetrics = async () => {
  // Vendor distribution states
  const vendorStatusDistribution = await prisma.vendor.groupBy({
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
  const topCategories = await prisma.vendorCategory.groupBy({
    by: ['categoryId'],
    _count: {
      vendorId: true,
    },
    orderBy: {
      _count: {
        vendorId: 'desc',
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
    vendorCount: tc._count.vendorId,
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

  return await prisma.vendor.update({
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

    const subscription = await tx.vendorSubscription.create({
      data: {
        vendorId,
        tier,
        expiresAt,
        isActive: true,
      },
    });

    const vendor = await tx.vendor.update({
      where: { id: vendorId },
      data: { membershipTier: tier },
    });

    return { subscription, vendor };
  });
};
