import slugify from 'slugify';
import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';

const generateSlug = (businessName, localityName, cityName) => {
  const base = `${businessName}-${localityName}-${cityName}`;
  return slugify(base, { lower: true, strict: true });
};

export const createVendor = async (data) => {
  const { businessName, registrationNumber, localityName, chowkLandmark, pincode, cityId, categoryIds } = data;

  // Check if registration number exists
  const existingVendor = await prisma.vendor.findUnique({
    where: { registrationNumber },
  });

  if (existingVendor) {
    throw new AppError(StatusCodes.CONFLICT, 'Vendor with this registration number already exists', true);
  }

  // Fetch city for slug generation
  const city = await prisma.city.findUnique({
    where: { id: cityId },
  });

  if (!city) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid city ID', true);
  }

  // Generate unique slug
  let slug = generateSlug(businessName, localityName, city.name);
  let slugExists = await prisma.vendor.findUnique({ where: { slug } });
  
  if (slugExists) {
    // Append random string to guarantee uniqueness if there is a collision
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Prepare category associations
  const vendorCategories = categoryIds.map((categoryId) => ({
    category: { connect: { id: categoryId } },
  }));

  const vendor = await prisma.vendor.create({
    data: {
      businessName,
      registrationNumber,
      localityName,
      chowkLandmark,
      pincode,
      cityId,
      slug,
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

  const updatedVendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      businessName: updateData.businessName,
      localityName: updateData.localityName,
      chowkLandmark: updateData.chowkLandmark,
      pincode: updateData.pincode,
      status: updateData.status,
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
