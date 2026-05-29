import slugify from 'slugify';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';

const generateSlug = (businessName, localityName, cityName) => {
  const base = `${businessName}-${localityName}-${cityName}`;
  return slugify(base, { lower: true, strict: true });
};

export const createVendor = async (data) => {
  const { 
    businessName, registrationNumber, localityName, chowkLandmark, pincode, cityName, categoryIds, userId,
    customServiceType, requestedCategory, timeAvailability, workingDays, locationType, idType, idNumber, membershipTier, latitude, longitude
  } = data;

  // Check if registration number exists
  const existingVendor = await prisma.vendor.findUnique({
    where: { registrationNumber },
  });

  if (existingVendor) {
    throw new AppError(StatusCodes.CONFLICT, 'Vendor with this registration number already exists', true);
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
      }
    });
  }

  // Generate unique slug
  let slug = generateSlug(businessName, localityName, city.name);
  let slugExists = await prisma.vendor.findUnique({ where: { slug } });
  
  if (slugExists) {
    // Append random string to guarantee uniqueness if there is a collision
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Prepare category associations
  const vendorCategories = (categoryIds || []).map((categoryId) => ({
    category: { connect: { id: categoryId } },
  }));

  const vendor = await prisma.vendor.create({
    data: {
      businessName,
      registrationNumber,
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
      idType,
      idNumber,
      membershipTier: membershipTier || 'Free',
      latitude,
      longitude,
      categories: {
        create: vendorCategories,
      },
    },
    include: {
      city: true,
      categories: {
        include: { category: true }
      }
    }
  });

  return vendor;
};

export const updateVendor = async (vendorId, updateData) => {
  // Check if vendor exists
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor || vendor.deletedAt !== null) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Vendor not found or suspended', true);
  }

  const allowedStatuses = ['available', 'busy', 'closed', 'emergency', 'suspended'];
  if (updateData.status && !allowedStatuses.includes(updateData.status)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid status value', true);
  }

  if (updateData.themeFlavor && updateData.themeFlavor !== 'trust-utility' && vendor.membershipTier !== 'Pro') {
    throw new AppError(StatusCodes.FORBIDDEN, "Pro tier required for custom themes", true);
  }

  const updatedVendor = await prisma.vendor.update({
    where: { id: vendorId },
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
    },
  });

  return updatedVendor;
};

export const softDeleteVendor = async (vendorId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Vendor not found', true);
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      status: 'suspended',
      deletedAt: new Date(),
    },
  });

  return { message: 'Vendor soft deleted successfully' };
};

// Register Vendor Self (by user)
export const registerVendorSelf = async (userId, data) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendor: true },
  });

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found', true);
  }

  if (user.vendor) {
    throw new AppError(StatusCodes.CONFLICT, 'User is already registered as a vendor', true);
  }

  // Create vendor profile using the existing createVendor logic, passing the userId
  const vendor = await createVendor({ ...data, userId });

  // Update user role to vendor
  await prisma.user.update({
    where: { id: userId },
    data: { role: 'vendor' },
  });

  return vendor;
};

// Fetch Vendor Profile by User ID (for Vendor Dashboard)
export const getVendorProfileByUserId = async (userId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    include: {
      city: true,
      categories: {
        include: { category: true },
      },
      media: true,
      subscriptions: true,
    },
  });

  if (!vendor || vendor.deletedAt !== null) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Vendor profile not found or suspended', true);
  }

  // Fetch lead metrics grouped by type
  const leadAnalytics = await prisma.leadAnalytic.groupBy({
    by: ['type'],
    where: { vendorId: vendor.id },
    _count: {
      type: true,
    },
  });

  const views = leadAnalytics.find((a) => a.type === 'profile_view')?._count.type || 0;
  const callClicks = leadAnalytics.find((a) => a.type === 'call_click')?._count.type || 0;
  const whatsappClicks = leadAnalytics.find((a) => a.type === 'whatsapp_click')?._count.type || 0;
  const totalClicks = callClicks + whatsappClicks;
  const conversionRate = views > 0 ? ((totalClicks / views) * 100).toFixed(2) + '%' : '0%';

  return {
    vendor,
    analytics: {
      views,
      callClicks,
      whatsappClicks,
      totalClicks,
      conversionRate,
    },
  };
};
