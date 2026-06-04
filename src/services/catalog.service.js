import prisma from '../config/prisma.js';
import { z } from 'zod';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

// Schemas
export const createCatalogItemSchema = z.object({
  vendorId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  unit: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true)
});

export const getCatalogItemSchema = z.object({
  vendorId: z.string().uuid(),
});

export const createCatalogItem = async (data) => {
  const parsed = createCatalogItemSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  // Ensure vendor and category exist
  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  if (!vendor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Vendor not found', true);
  }

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Category not found', true);
  }

  const item = await prisma.catalogItem.create({
    data: parsed.data,
    include: {
      category: true
    }
  });

  return item;
};

export const getCatalogItemsByVendor = async (vendorId) => {
  const parsed = getCatalogItemSchema.safeParse({ vendorId });
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const items = await prisma.catalogItem.findMany({
    where: { vendorId },
    include: {
      category: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return items;
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
    vendor: {
      status: 'available', // Only show items from available vendors
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
        vendor: {
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
    include: { vendor: true }
  });

  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }

  const lead = await prisma.lead.create({
    data: {
      catalogItemId: item.id,
      vendorId: item.vendorId,
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
  isAvailable: z.boolean().optional()
});

export const updateCatalogItem = async (id, vendorId, data) => {
  const parsed = updateCatalogItemSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  // Ensure catalog item exists and belongs to this vendor
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }
  if (vendorId !== 'ADMIN' && item.vendorId !== vendorId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not own this catalog item', true);
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Category not found', true);
    }
  }

  const updatedItem = await prisma.catalogItem.update({
    where: { id },
    data: parsed.data,
    include: {
      category: true
    }
  });

  return updatedItem;
};

export const deleteCatalogItem = async (id, vendorId) => {
  // Ensure catalog item exists and belongs to this vendor
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Catalog item not found', true);
  }
  if (vendorId !== 'ADMIN' && item.vendorId !== vendorId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not own this catalog item', true);
  }

  await prisma.catalogItem.delete({
    where: { id }
  });

  return { success: true };
};
