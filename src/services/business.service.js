import slugify from 'slugify';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { z } from 'zod';
import env, { ENABLED_VERTICALS } from '../config/env.js';

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
    customServiceType, requestedCategory, timeAvailability, workingDays, locationType, businessType, idType, idNumber, membershipTier, latitude, longitude, metaData, services, connectionMode, state, district
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

  if (!cityName) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'City name is required', true);
  }

  // Find or Create the city by slug/name
  const citySlug = slugify(cityName, { lower: true, strict: true });
  let city = await prisma.city.findUnique({
    where: { slug: citySlug },
  });

  if (!city) {
    city = await prisma.city.create({
      data: {
        name: cityName,
        slug: citySlug,
        state: state || env.DEFAULT_STATE,
        district: district || null,
      }
    });
  }

  // Generate unique slug
  let slug = generateSlug(businessName, localityName, city.name);
  let slugExists = await prisma.businessProfile.findUnique({ where: { slug } });
  
  if (slugExists) {
    // Append random string to guarantee uniqueness if there is a collision
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Prepare category associations
  const businessCategories = (categoryIds || []).map((categoryId) => ({
    category: { connect: { id: categoryId } },
  }));

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
      businessType: businessType || 'HOME_MAINTENANCE',
      idType,
      idNumber,
      membershipTier: membershipTier || 'Free',
      latitude,
      longitude,
      metaData,
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

  if (updateData.businessType && !['FOOD_BEVERAGE', 'SALON_BEAUTY'].includes(updateData.businessType)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Only Restaurant and Salon vendors are allowed', true);
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

// Fetch Dashboard Analytics for a single business
export const getBusinessDashboardData = async (businessId) => {
  const business = await prisma.businessProfile.findUnique({
    where: { id: businessId, deletedAt: null },
    include: {
      city: true,
      categories: { include: { category: true } },
      subscriptions: { where: { isActive: true } },
      media: true,
      catalogItems: {
        where: { isActive: true },
        include: { category: true }
      }
    }
  });

  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business profile not found', true);
  }

  // Fetch analytics from OrderEnquiry and LeadAnalytic
  const [totalOrders, totalRevenue, leadAnalytics] = await Promise.all([
    prisma.orderEnquiry.count({ where: { businessProfileId: business.id } }),
    prisma.orderEnquiry.aggregate({
      where: { businessProfileId: business.id, status: 'COMPLETED' },
      _sum: { totalValue: true }
    }),
    prisma.leadAnalytic.groupBy({
      by: ['type'],
      where: { businessProfileId: business.id },
      _count: { type: true }
    })
  ]);

  const analyticsCounts = leadAnalytics.reduce((acc, curr) => {
    acc[curr.type] = curr._count.type;
    return acc;
  }, {});

  const analytics = {
    totalOrders,
    totalRevenue: totalRevenue._sum.totalValue || 0,
    profileViews: analyticsCounts['profile_view'] || 0,
    callClicks: analyticsCounts['call_click'] || 0,
    whatsappClicks: analyticsCounts['whatsapp_click'] || 0,
  };

  return { business, analytics };
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
