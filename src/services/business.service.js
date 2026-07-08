import slugify from 'slugify';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { z } from 'zod';
import env, { ENABLED_VERTICALS } from '../config/env.js';
import { getModuleConfig, resolveListingTier, getVertical } from '../config/verticals.js';
import { isValidDistrict, canonicalDistrict } from '../config/regions.js';
import { recordAuditLog } from './auditLog.service.js';

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

/**
 * Version 1.2 Sprint 3 Batch 2: surfaces existing businesses that might be
 * the same physical business as a new self-registration, so a vendor can
 * claim an existing (possibly unclaimed) listing instead of creating a
 * duplicate. Deliberately advisory only — never blocks registration. Name
 * matching is a simple one-directional substring check (existing name
 * contains the submitted name), not fuzzy/full-text matching — proportionate
 * to being a suggestion, not an authoritative duplicate determination.
 */
export const findPotentialDuplicates = async ({ businessName, district, pincode, state }) => {
  if (!businessName || !businessName.trim()) return [];

  const effectiveState = state || env.DEFAULT_STATE;
  const districtName =
    district && isValidDistrict(effectiveState, district) ? canonicalDistrict(effectiveState, district) : district;

  const nameNorm = businessName.trim();

  return prisma.businessProfile.findMany({
    where: {
      deletedAt: null,
      OR: [{ businessName: { contains: nameNorm, mode: 'insensitive' } }, ...(pincode ? [{ pincode }] : [])],
      ...(districtName ? { city: { district: districtName } } : {}),
    },
    select: {
      id: true,
      businessName: true,
      slug: true,
      isClaimed: true,
      localityName: true,
      pincode: true,
      city: { select: { name: true, district: true } },
    },
    take: 5,
    // Unclaimed stubs first — those are the "claim this instead" candidates.
    orderBy: [{ isClaimed: 'asc' }],
  });
};

/**
 * Version 1.2 Sprint 3 Batch 4: lightweight, public list of every live
 * business's slug + last-updated timestamp, consumed by the frontend
 * sitemap.ts so individual storefronts are indexable — previously the
 * sitemap only listed the directory hub and district/category spokes, not
 * a single business page.
 */
export const getSitemapSlugs = async () => {
  return prisma.businessProfile.findMany({
    where: { deletedAt: null },
    select: { slug: true, updatedAt: true },
  });
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
      operatingHours: updateData.operatingHours,
      // Merge metaData: spread existing fields then apply incoming patch.
      // This prevents a partial update (e.g. writing operatingHours) from
      // wiping out previously stored fields (e.g. restaurantDetails, cuisines).
      ...(updateData.metaData !== undefined && {
        metaData: {
          ...(typeof business.metaData === 'object' && business.metaData !== null ? business.metaData : {}),
          ...updateData.metaData,
        },
      }),
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

// Shared by computeCompleteness (dashboard nudge) and computeVerificationReadiness
// (verification gate) so the two checklists can't silently drift apart.
// NOTE: 'hours' checks timeAvailability/workingDays (the fields onboarding
// actually sets) rather than the separate operatingHours Json field, which
// nothing in the onboarding flow populates today.
const buildBaseCompletenessItems = (business) => {
  const meta = business.metaData || {};
  return [
    { key: 'photo', label: 'Add a photo', done: (business.media?.length || 0) > 0 },
    { key: 'hours', label: 'Set operating hours', done: !!(business.operatingHours || business.timeAvailability || business.workingDays) },
    { key: 'location', label: 'Pin your location', done: business.latitude != null && business.longitude != null },
    { key: 'category', label: 'Choose a category', done: (business.categories?.length || 0) > 0 },
    { key: 'about', label: 'Write a short description', done: !!(meta.description || meta.about || meta.bio) },
  ];
};

/**
 * Business Readiness Score for the vendor growth dashboard (Phase F5, Sprint 2
 * Batch 2 rename). Tier-aware: COMMERCE/BOOKABLE listings also need a catalog.
 * Returns a percent plus the per-item checklist so the UI can nudge the vendor
 * to finish the gaps.
 */
export const computeCompleteness = (business) => {
  const tier = business.listingTier || 'DIRECTORY';
  const items = [
    ...buildBaseCompletenessItems(business),
    { key: 'verify', label: 'Verify your ID', done: !!business.idVerified },
  ];
  if (tier === 'COMMERCE' || tier === 'BOOKABLE') {
    items.push({ key: 'catalog', label: 'Add items to your catalog', done: (business.catalogItems?.length || 0) > 0 });
  }
  const completed = items.filter((i) => i.done).length;
  const percent = Math.round((completed / items.length) * 100);
  return { percent, completed, total: items.length, items };
};

/**
 * Business Readiness Categorization (Version 1.2, Sprint 3 Batch 1). Buckets
 * computeCompleteness's flat checklist into named categories so a vendor sees
 * *what kind* of thing is missing, not just one overall percentage — the
 * Founder's own Sprint 2 recommendation, deferred at the time as future work.
 *
 * Purely a presentation layer over the existing checklist: it does not
 * change computeCompleteness's overall percent or computeVerificationReadiness's
 * gate logic at all, so the already-tested verification gate from Sprint 2
 * Batch 2 is untouched.
 *
 * 'Trust' is not built from checklist items — a vendor can't tick a box to
 * make a customer leave a review, so it's an earned, read-only signal
 * (has the business been reviewed, and how well) rather than a to-do list.
 */
export const categorizeReadiness = (business) => {
  const completeness = computeCompleteness(business);
  const byKey = Object.fromEntries(completeness.items.map((i) => [i.key, i]));
  const tier = business.listingTier || 'DIRECTORY';
  const catalogApplicable = tier === 'COMMERCE' || tier === 'BOOKABLE';

  const percentOf = (items) =>
    items.length === 0 ? null : Math.round((items.filter((i) => i.done).length / items.length) * 100);

  const identityItems = ['verify'].map((k) => byKey[k]).filter(Boolean);
  const profileItems = ['photo', 'hours', 'location', 'category', 'about'].map((k) => byKey[k]).filter(Boolean);
  const catalogItems = catalogApplicable ? ['catalog'].map((k) => byKey[k]).filter(Boolean) : [];

  const reviewCount = business.reviews?.length ?? business._count?.reviews ?? 0;
  const rating = business.rating || 0;
  // Two independent 50%-weighted signals: has any review at all, and is the
  // rating at least 4.0 — deliberately simple, not a tuned formula.
  const trustPercent = (reviewCount > 0 ? 50 : 0) + (rating >= 4 ? 50 : 0);

  return {
    overallPercent: completeness.percent,
    categories: [
      // Labeled "Verification" (not "Identity") per Founder feedback — more
      // familiar/actionable to a vendor; the underlying key stays 'identity'
      // so nothing else keying off it needs to change.
      { key: 'identity', label: 'Verification', percent: percentOf(identityItems), items: identityItems, editable: true },
      { key: 'profile', label: 'Profile', percent: percentOf(profileItems), items: profileItems, editable: true },
      {
        key: 'catalog',
        label: 'Catalog',
        percent: catalogApplicable ? percentOf(catalogItems) : null,
        applicable: catalogApplicable,
        items: catalogItems,
        editable: true,
      },
      {
        key: 'trust',
        label: 'Trust',
        percent: trustPercent,
        items: [],
        editable: false,
        detail: { reviewCount, rating },
      },
    ],
  };
};

/**
 * Gate for requesting ID verification (Sprint 2 Batch 2). Deliberately
 * excludes 'verify' (computeCompleteness's own item — a vendor can never be
 * ready-to-verify if verification counts as its own prerequisite) and
 * 'catalog' (a commerce-readiness concern, not identity/listing-quality).
 * Adds a verification-document-specific check a generic photo doesn't satisfy.
 */
export const computeVerificationReadiness = (business) => {
  const items = [
    ...buildBaseCompletenessItems(business),
    {
      key: 'verification_doc',
      label: 'Upload an ID/registration document',
      done: (business.media || []).some((m) => m.type === 'verification_doc'),
    },
  ];
  const missing = items.filter((i) => !i.done);
  return { ready: missing.length === 0, items, missing };
};

/**
 * Vendor-facing: submit the business for ID verification. Blocked until the
 * Business Readiness gate passes — a verified badge should mean both "we
 * checked their identity" and "this is a complete, trustworthy listing."
 */
export const submitVerificationRequest = async (businessId) => {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId },
    include: { media: true, categories: true },
  });

  if (!business || business.deletedAt !== null) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found or suspended', true);
  }
  if (business.verificationStatus === 'PENDING') {
    throw new AppError(StatusCodes.CONFLICT, 'A verification request is already pending review.', true);
  }
  if (business.idVerified || business.verificationStatus === 'APPROVED') {
    throw new AppError(StatusCodes.CONFLICT, 'This business is already verified.', true);
  }

  const readiness = computeVerificationReadiness(business);
  if (!readiness.ready) {
    // The frontend gates the submit action using the dashboard's
    // verificationReadiness.missing list before this is ever called — this is
    // a defensive backstop, so a plain message is enough (the error handler
    // doesn't serialize extra AppError properties to the client).
    throw new AppError(StatusCodes.BAD_REQUEST, 'Your listing is not ready for verification yet. Complete the missing items first.', true);
  }

  return prisma.businessProfile.update({
    where: { id: businessId },
    data: {
      verificationStatus: 'PENDING',
      verificationSubmittedAt: new Date(),
      verificationRejectionReason: null,
    },
  });
};

/** Admin-facing: businesses with a pending verification request, oldest first. */
export const getVerificationQueue = async () => {
  return prisma.businessProfile.findMany({
    where: { verificationStatus: 'PENDING' },
    include: {
      user: { select: { phoneNumber: true, email: true, name: true } },
      media: { where: { type: 'verification_doc' } },
      city: true,
    },
    orderBy: { verificationSubmittedAt: 'asc' },
  });
};

/** Admin-facing: approve or reject a pending verification request. */
export const reviewVerificationRequest = async (businessId, decision, rejectionReason, actor = {}) => {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'decision must be APPROVED or REJECTED', true);
  }
  if (decision === 'REJECTED' && !rejectionReason) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'A rejection reason is required when rejecting a verification request.', true);
  }

  const business = await prisma.businessProfile.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }
  if (business.verificationStatus !== 'PENDING') {
    throw new AppError(StatusCodes.CONFLICT, 'This business has no pending verification request.', true);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.businessProfile.update({
      where: { id: businessId },
      data: {
        verificationStatus: decision,
        verificationReviewedAt: new Date(),
        verificationRejectionReason: decision === 'REJECTED' ? rejectionReason : null,
        idVerified: decision === 'APPROVED' ? true : business.idVerified,
      },
      include: { user: { select: { phoneNumber: true, name: true } } },
    });

    await recordAuditLog(tx, {
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: decision === 'APPROVED' ? 'VENDOR_VERIFICATION_APPROVED' : 'VENDOR_VERIFICATION_REJECTED',
      entityType: 'BusinessProfile',
      entityId: businessId,
      metadata: decision === 'REJECTED' ? { rejectionReason } : undefined,
    });

    return updated;
  });
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

  // Last-14-day window for dailySeries chart
  const now = new Date();
  const thirteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  const istThirteenDaysAgo = new Date(thirteenDaysAgo.getTime() + (5.5 * 60 * 60 * 1000));
  istThirteenDaysAgo.setUTCHours(0, 0, 0, 0);
  const startOfSeriesUTC = new Date(istThirteenDaysAgo.getTime() - (5.5 * 60 * 60 * 1000));

  // Fetch analytics from OrderEnquiry and LeadAnalytic
  const [totalOrders, totalRevenue, leadAnalytics, recentAnalytics, leadRows] = await Promise.all([
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
    }),
    prisma.leadAnalytic.findMany({
      where: {
        businessProfileId: business.id,
        createdAt: { gte: startOfSeriesUTC }
      }
    })
  ]);

  const toCounts = (rows) => rows.reduce((acc, curr) => {
    acc[curr.type] = curr._count.type;
    return acc;
  }, {});
  const analyticsCounts = toCounts(leadAnalytics);
  const recentCounts = toCounts(recentAnalytics);

  // Get YYYY-MM-DD string in IST (UTC+5:30) timezone
  const getISTDateString = (date) => {
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dailySeries = [];
  const dateMap = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getISTDateString(d);
    const entry = { date: dateStr, views: 0, leads: 0 };
    dailySeries.push(entry);
    dateMap[dateStr] = entry;
  }

  for (const row of leadRows) {
    const dateStr = getISTDateString(row.createdAt);
    if (dateMap[dateStr]) {
      if (row.type === 'profile_view') {
        dateMap[dateStr].views += 1;
      } else if (row.type === 'call_click' || row.type === 'whatsapp_click') {
        dateMap[dateStr].leads += 1;
      }
    }
  }

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
    dailySeries
  };

  // Business Readiness Score checklist (growth-dashboard nudge).
  const completeness = computeCompleteness(business);

  // Categorized breakdown of the same checklist (Version 1.2 Sprint 3 Batch 1).
  const readinessCategories = categorizeReadiness(business);

  // Verification-request gate — separate from completeness (see computeVerificationReadiness).
  const verificationReadiness = computeVerificationReadiness(business);

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

  return { business, analytics, completeness, readinessCategories, verificationReadiness, funnel };
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
      },
      _count: { select: { reviews: true } }
    }
  });

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }

  return business;
};
