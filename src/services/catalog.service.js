import prisma from '../config/prisma.js';
import { z } from 'zod';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

// Schemas
export const createCatalogItemSchema = z.object({
  businessProfileId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  unit: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  variants: z.any().optional(),
  metaData: z.any().optional(),
  foodCategory: z.string().optional(),
  isVeg: z.boolean().optional(),
});

export const getCatalogItemSchema = z.object({
  businessProfileId: z.string().uuid(),
});

export const createCatalogItem = async (data) => {
  const parsed = createCatalogItemSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  // Ensure business exists
  const business = await prisma.businessProfile.findUnique({ where: { id: data.businessProfileId } });
  if (!business) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }

  let finalCategoryId = parsed.data.categoryId;

  // Generic Category Fallback
  if (!finalCategoryId) {
    let generalCat = await prisma.category.findFirst({ where: { slug: 'general' } });
    if (!generalCat) {
      generalCat = await prisma.category.create({ data: { name: 'General', slug: 'general' } });
    }
    finalCategoryId = generalCat.id;
  } else {
    const category = await prisma.category.findUnique({ where: { id: finalCategoryId } });
    if (!category) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Category not found', true);
    }
  }

  const { foodCategory, isVeg, metaData, ...prismaData } = parsed.data;

  const item = await prisma.catalogItem.create({
    data: {
      ...prismaData,
      categoryId: finalCategoryId,
      metaData: {
        ...(metaData || {}),
        foodCategory,
        isVeg,
      }
    },
    include: {
      category: true
    }
  });

  return item;
};

export const getCatalogItemsByBusiness = async (businessProfileId) => {
  const parsed = getCatalogItemSchema.safeParse({ businessProfileId });
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const items = await prisma.catalogItem.findMany({
    where: { businessProfileId },
    include: {
      category: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return items;
};

export const getCatalogItemById = async (id) => {
  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: {
      category: true,
      businessProfile: {
        select: {
          id: true,
          businessName: true,
          status: true,
          rating: true,
          slug: true,
          localityName: true,
          businessType: true,
          media: true,
          membershipTier: true
        }
      }
    }
  });

  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }

  return item;
};

export const exploreCatalogItemsSchema = z.object({
  citySlug: z.string().optional(),
  categorySlug: z.string().optional(),
  searchQuery: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export const exploreCatalogItems = async (filters) => {
  const parsed = exploreCatalogItemsSchema.safeParse(filters);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const { citySlug, categorySlug, searchQuery, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    businessProfile: {
      status: 'available', // Only show items from available businesses
      ...(citySlug && { city: { slug: citySlug } }),
      ...(categorySlug && { categories: { some: { category: { slug: categorySlug } } } }),
    },
    ...(searchQuery && {
      OR: [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.catalogItem.findMany({
      where,
      include: {
        businessProfile: {
          select: {
            id: true,
            businessName: true,
            status: true,
            rating: true,
            slug: true,
          }
        },
        category: {
          select: { name: true, slug: true }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.catalogItem.count({ where })
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

export const createLeadSchema = z.object({
  catalogItemId: z.string().uuid(),
  customerName: z.string().min(2, 'Name is required'),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format'),
  customerRequirement: z.string().optional(),
});

export const createLead = async (data) => {
  const parsed = createLeadSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const item = await prisma.catalogItem.findUnique({
    where: { id: data.catalogItemId },
    include: { businessProfile: true }
  });

  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }

  const lead = await prisma.lead.create({
    data: {
      catalogItemId: item.id,
      businessProfileId: item.businessProfileId,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerRequirement: parsed.data.customerRequirement,
      status: 'NEW'
    }
  });

  return lead;
};

export const updateCatalogItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  unit: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  variants: z.any().optional(),
  metaData: z.any().optional(),
  foodCategory: z.string().optional(),
  isVeg: z.boolean().optional(),
});

export const updateCatalogItem = async (id, businessProfileId, data) => {
  const parsed = updateCatalogItemSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  // Ensure catalog item exists and belongs to this business
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }
  if (businessProfileId !== 'ADMIN' && item.businessProfileId !== businessProfileId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not own this catalog item', true);
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Category not found', true);
    }
  }

  const { foodCategory, isVeg, metaData, ...prismaData } = parsed.data;

  const updatedItem = await prisma.catalogItem.update({
    where: { id },
    data: {
      ...prismaData,
      metaData: {
        ...(item.metaData || {}),
        ...(metaData || {}),
        ...(foodCategory !== undefined ? { foodCategory } : {}),
        ...(isVeg !== undefined ? { isVeg } : {})
      }
    },
    include: {
      category: true
    }
  });

  return updatedItem;
};

export const deleteCatalogItem = async (id, businessProfileId) => {
  // Ensure catalog item exists and belongs to this business
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }
  if (businessProfileId !== 'ADMIN' && item.businessProfileId !== businessProfileId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not own this catalog item', true);
  }

  await prisma.catalogItem.delete({
    where: { id }
  });

  return { success: true };
};
