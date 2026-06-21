import slugify from 'slugify';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { z } from 'zod';
import env, { ENABLED_VERTICALS } from '../config/env.js';
import { getModuleConfig, resolveListingTier, getVertical } from '../config/verticals.js';
import { isValidDistrict, canonicalDistrict } from '../config/regions.js';

const generateSlug = (businessName, localityName, cityName) => {
  const base = `${businessName}-${localityName}-${cityName}`;
  return slugify(base, { lower: true, strict: true });
};

export const validateMetaData = (businessType, metaData) => {
  if (!metaData) return;

  try {
    if (businessType === 'CAB_TRANSPORT') {
      const schema = z.object({
        vehicleDetails: z.object({
          model: z.string().optional(),
          type: z.string().optional(),
          ac: z.boolean().optional(),
          seats: z.number().int().optional()
        }).optional()
      }).passthrough();
      schema.parse(metaData);
    } else if (businessType === 'FOOD_BEVERAGE') {
      const schema = z.object({
        restaurantDetails: z.object({
          isVeg: z.boolean().optional(),
          fssai: z.string().optional()
        }).optional()
      }).passthrough();
      schema.parse(metaData);
    }
  } catch (error) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid metaData structure for ${businessType}: ${error.issues?.[0]?.message || error.message}`, true);
  }
};

export const createBusinessProfile = async (data) => {
  const { 
    businessName, registrationNumber, localityName, chowkLandmark, pincode, cityName, categoryIds, userId,
    customServiceType, requestedCategory, timeAvailability, workingDays, locationType, businessType, idType, idNumber, membershipTier, latitude, longitude, metaData, services, connectionMode, state, district,
    subcategorySlug, bookingMode, themeFlavor
  } = data;

  const actualBusinessType = (businessType || 'FOOD_BEVERAGE').toUpperCase();
  if (!ENABLED_VERTICALS.includes(actualBusinessType)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'This vertical is not open for registration yet.', true);
  }
  validateMetaData(actualBusinessType, metaData);

  // Check if registration number exists if provided
  if (registrationNumber) {
    const existingBusiness = await prisma.businessProfile.findUnique({
      where: { registrationNumber },
    });

    if (existingBusiness) {
      throw new AppError(StatusCodes.CONFLICT, 'Business with this registration number already exists', true);
    }
  }

  // Location (Phase E): State + District are the canonical onboarding location.
  // Validate the district against the hardcoded region registry, normalize it to
  // its canonical name, and default the (finer) cityName to the district when no
  // more specific locality city is given — so City.district is always populated.
  const effectiveState = state || env.DEFAULT_STATE;
  if (!district) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'District is required', true);
  }
  if (!isValidDistrict(effectiveState, district)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `"${district}" is not a valid district for ${effectiveState}`, true);
  }
  const districtName = canonicalDistrict(effectiveState, district);
  const effectiveCityName = cityName || districtName;

  // Find or Create the city by slug/name
  const citySlug = slugify(effectiveCityName, { lower: true, strict: true });
  let city = await prisma.city.findUnique({
    where: { slug: citySlug },
  });

  if (!city) {
    city = await prisma.city.create({
      data: {
        name: effectiveCityName,
        slug: citySlug,
        state: effectiveState,
        district: districtName,
      }
    });
  } else if (!city.district) {
    // Backfill the district on a pre-existing free-text city row so it matches
    // the district filter going forward (legacy rows had district = null).
    city = await prisma.city.update({
      where: { id: city.id },
      data: { district: districtName },
    });
  }

  // Generate unique slug
  let slug = generateSlug(businessName, localityName, city.name);
  let slugExists = await prisma.businessProfile.findUnique({ where: { slug } });
  
  if (slugExists) {
    // Append random string to guarantee uniqueness if there is a collision
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Prepare category associations from explicit ids…
  const categoryConnectIds = new Set(categoryIds || []);

  // …and resolve a sub-category slug (from the new onboarding) to its Category id.
  if (subcategorySlug) {
    const sub = await prisma.category.findUnique({ where: { slug: subcategorySlug } });
    if (sub) categoryConnectIds.add(sub.id);
  }

  const businessCategories = [...categoryConnectIds].map((categoryId) => ({
    category: { connect: { id: categoryId } },
  }));

  // Capability blueprint is derived server-side from the vertical (never trusted from client).
  const moduleConfig = getModuleConfig(actualBusinessType);
  // Listing tier (Phase F) is auto-assigned from the vertical's defaultTier, with a
  // sub-category override (e.g. a doctor within Health & Medical → BOOKABLE). Tier is
  // the public label / CTA driver; vendors upgrade later via the storefront upsell.
  const listingTier = resolveListingTier(actualBusinessType, subcategorySlug);

  // Resolve generic category for services
  let generalCat = await prisma.category.findFirst({ where: { slug: 'general' } });
  if (!generalCat && (services && services.length > 0)) {
    generalCat = await prisma.category.create({ data: { name: 'General', slug: 'general' } });
  }

  const catalogItemsCreate = (services || []).map(s => ({
    title: s.title,
    price: s.price || null,
    description: s.description || null,
    categoryId: generalCat.id,
    variants: s.variants && s.variants.length > 0 ? s.variants : undefined,
    metaData: {
      foodCategory: s.foodCategory || 'General',
      isVeg: s.isVeg,
    },
    isActive: true,
    isAvailable: true
  }));

  const finalRegistrationNumber = registrationNumber || `REG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const business = await prisma.businessProfile.create({
    data: {
      businessName,
      registrationNumber: finalRegistrationNumber,
      localityName,
      chowkLandmark,
      pincode,
      cityId: city.id,
      slug,
      userId: userId || null,
      customServiceType,
      requestedCategory,
      timeAvailability,
      workingDays,
      locationType,
      businessType: actualBusinessType,
      idType,
      idNumber,
      membershipTier: membershipTier || 'Free',
      latitude,
      longitude,
      metaData,
      moduleConfig,
      listingTier,
      bookingMode: bookingMode || null,
      ...(themeFlavor ? { themeFlavor } : {}),
      connectionMode: connectionMode || 'REQUIRE_APPROVAL',
      categories: {
        create: businessCategories,
      },
      catalogItems: {
        create: catalogItemsCreate,
      }
    },
    include: {
      city: true,
      categories: {
        include: { category: true }
      }
    }
  });

  return business;
};

export const updateBusinessProfile = async (businessId, updateData) => {
  // Check if business exists
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
  });

  if (!business || business.deletedAt !== null) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found or suspended', true);
  }

  const allowedStatuses = ['available', 'busy', 'closed', 'emergency', 'suspended'];
  if (updateData.status && !allowedStatuses.includes(updateData.status)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid status value', true);
  }

  // Enforce Pro tier requirement for custom/premium themes
  if (updateData.themeFlavor && updateData.themeFlavor === 'luxury' && business.membershipTier !== 'Pro') {
    throw new AppError(StatusCodes.FORBIDDEN, 'Pro tier required for custom themes', true);
  }

  if (updateData.businessType && !ENABLED_VERTICALS.includes(updateData.businessType.toUpperCase())) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'This vertical is not open for registration yet.', true);
  }

  if (updateData.metaData !== undefined) {
    validateMetaData(updateData.businessType || business.businessType, updateData.metaData);
  }

  const updatedBusiness = await prisma.businessProfile.update({
    where: { id: businessId },
    data: {
      businessName: updateData.businessName,
      localityName: updateData.localityName,
      chowkLandmark: updateData.chowkLandmark,
      pincode: updateData.pincode,
      status: updateData.status,
      timeAvailability: updateData.timeAvailability,
      workingDays: updateData.workingDays,
      locationType: updateData.locationType,
      customServiceType: updateData.customServiceType,
      themeFlavor: updateData.themeFlavor,
      idType: updateData.idType,
      idNumber: updateData.idNumber,
      metaData: updateData.metaData,
      connectionMode: updateData.connectionMode,
    },
  });

  return updatedBusiness;
};

export const softDeleteBusinessProfile = async (businessId) => {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }

  await prisma.businessProfile.update({
    where: { id: businessId },
    data: {
      status: 'suspended',
      deletedAt: new Date(),
    },
  });

  return { message: 'Business soft deleted successfully' };
};

// Register Business Self (by user)
export const registerBusinessSelf = async (userId, data) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found', true);
  }

  // Create business profile
  const business = await createBusinessProfile({ ...data, userId });

  // Update user role to vendor and hasVendorProfile to true
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'vendor', hasVendorProfile: true },
  });

  return business;
};

// Fetch All Businesses for a logged-in user
export const getMyBusinesses = async (userId) => {
  const businesses = await prisma.businessProfile.findMany({
    where: { userId, deletedAt: null },
    include: {
      city: true,
      categories: { include: { category: true } },
    }
  });

  return businesses;
};

/**
 * Profile-completeness score for the vendor growth dashboard (Phase F5).
 * Tier-aware: COMMERCE/BOOKABLE listings also need a catalog. Returns a percent
 * plus the per-item checklist so the UI can nudge the vendor to finish the gaps.
 */
const computeCompleteness = (business) => {
  const tier = business.listingTier || 'DIRECTORY';
  const meta = business.metaData || {};
  const items = [
    { key: 'photo', label: 'Add a photo', done: (business.media?.length || 0) > 0 },
    { key: 'hours', label: 'Set operating hours', done: !!business.operatingHours },
    { key: 'location', label: 'Pin your location', done: business.latitude != null && business.longitude != null },
    { key: 'category', label: 'Choose a category', done: (business.categories?.length || 0) > 0 },
    { key: 'about', label: 'Write a short description', done: !!(meta.description || meta.about || meta.bio) },
    { key: 'verify', label: 'Verify your ID', done: !!business.idVerified },
  ];
  if (tier === 'COMMERCE' || tier === 'BOOKABLE') {
    items.push({ key: 'catalog', label: 'Add items to your catalog', done: (business.catalogItems?.length || 0) > 0 });
  }
  const completed = items.filter((i) => i.done).length;
  const percent = Math.round((completed / items.length) * 100);
  return { percent, completed, total: items.length, items };
};

// Fetch Dashboard Analytics for a single business
export const getBusinessDashboardData = async (businessId) => {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId, deletedAt: null },
    include: {
      city: true,
      categories: { include: { category: true } },
      subscriptions: { where: { isActive: true } },
      media: true,
      reviews: { select: { id: true } },
      catalogItems: {
        where: { isActive: true },
        include: { category: true }
      }
    }
  });

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business profile not found', true);
  }

  // Last-30-day window for the "recent activity" trend (Phase F5).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch analytics from OrderEnquiry and LeadAnalytic
  const [totalOrders, totalRevenue, leadAnalytics, recentAnalytics] = await Promise.all([
    prisma.orderEnquiry.count({ where: { businessProfileId: business.id } }),
    prisma.orderEnquiry.aggregate({
      where: { businessProfileId: business.id, status: 'COMPLETED' },
      _sum: { totalValue: true }
    }),
    prisma.leadAnalytic.groupBy({
      by: ['type'],
      where: { businessProfileId: business.id },
      _count: { type: true }
    }),
    prisma.leadAnalytic.groupBy({
      by: ['type'],
      where: { businessProfileId: business.id, createdAt: { gte: since } },
      _count: { type: true }
    })
  ]);

  const toCounts = (rows) => rows.reduce((acc, curr) => {
    acc[curr.type] = curr._count.type;
    return acc;
  }, {});
  const analyticsCounts = toCounts(leadAnalytics);
  const recentCounts = toCounts(recentAnalytics);

  const analytics = {
    totalOrders,
    totalRevenue: totalRevenue._sum.totalValue || 0,
    profileViews: analyticsCounts['profile_view'] || 0,
    callClicks: analyticsCounts['call_click'] || 0,
    whatsappClicks: analyticsCounts['whatsapp_click'] || 0,
    totalLeads: (analyticsCounts['call_click'] || 0) + (analyticsCounts['whatsapp_click'] || 0),
    rating: business.rating || 0,
    reviewCount: business.reviews?.length || 0,
    last30Days: {
      profileViews: recentCounts['profile_view'] || 0,
      callClicks: recentCounts['call_click'] || 0,
      whatsappClicks: recentCounts['whatsapp_click'] || 0,
      leads: (recentCounts['call_click'] || 0) + (recentCounts['whatsapp_click'] || 0),
    },
  };

  // Profile-completeness checklist.
  const completeness = computeCompleteness(business);

  // Claim & upgrade funnel state — drives the "Activate your storefront / your own
  // app" upsell. upgradeableTo comes from the vertical config; current tier is the
  // public label already stored on the profile.
  const vertical = getVertical(business.businessType);
  const funnel = {
    isClaimed: business.isClaimed,
    source: business.source || 'self',
    listingTier: business.listingTier || 'DIRECTORY',
    upgradeableTo: vertical?.upgradeableTo || [],
  };

  return { business, analytics, completeness, funnel };
};

export const getBusinessBySlug = async (slug) => {
  const business = await prisma.businessProfile.findUnique({
    where: { slug, deletedAt: null },
    include: {
      city: true,
      categories: { include: { category: true } },
      media: true,
      user: {
        select: {
          phoneNumber: true,
          name: true
        }
      },
      catalogItems: {
        where: { isActive: true },
        include: { category: true }
      }
    }
  });

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }

  return business;
};
