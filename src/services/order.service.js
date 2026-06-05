import prisma from '../config/prisma.js';
import { z } from 'zod';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

// Schemas
export const checkoutSchema = z.object({
  businessProfileId: z.string().uuid(),
  orderType: z.enum(['TRANSACTIONAL', 'BOOKING']),
  customerName: z.string().min(2, 'Name is required'),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format'),
  serviceLocation: z.string().optional(),
  scheduledAt: z.string().datetime().optional(), // ISO 8601 string
  items: z.array(z.object({
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'At least one item is required')
});

export const processCheckout = async (data, customerId = null) => {
  const parsed = checkoutSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const { businessProfileId, orderType, customerName, customerPhone, serviceLocation, scheduledAt, items } = parsed.data;

  // Validate Business Profile
  const businessProfile = await prisma.businessProfile.findUnique({ where: { id: businessProfileId } });
  if (!businessProfile) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Business not found', true);
  }

  // Fetch Catalog Items
  const catalogItemIds = items.map(item => item.catalogItemId);
  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      id: { in: catalogItemIds },
      businessProfileId: businessProfileId, // ensure all items belong to the same business
      isAvailable: true
    }
  });

  if (catalogItems.length !== items.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'One or more items are invalid, unavailable, or do not belong to this business', true);
  }

  // Calculate Total & Prepare OrderItems
  let totalValue = 0;
  const orderItemsData = items.map(inputItem => {
    const dbItem = catalogItems.find(ci => ci.id === inputItem.catalogItemId);
    const priceAtTimeOfOrder = dbItem.price || 0;
    totalValue += (parseFloat(priceAtTimeOfOrder) * inputItem.quantity);

    return {
      catalogItemId: dbItem.id,
      quantity: inputItem.quantity,
      priceAtTimeOfOrder: priceAtTimeOfOrder
    };
  });

  // Create OrderEnquiry within a transaction
  const orderEnquiry = await prisma.$transaction(async (tx) => {
    const order = await tx.orderEnquiry.create({
      data: {
        businessProfileId,
        customerId,
        orderType,
        customerName,
        customerPhone,
        serviceLocation,
        totalValue,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'PENDING',
        items: {
          create: orderItemsData
        }
      },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        },
        businessProfile: {
          include: {
            user: true
          }
        }
      }
    });
    return order;
  });

  return orderEnquiry;
};

export const getMyOrders = async (customerId) => {
  if (!customerId) return [];
  const orders = await prisma.orderEnquiry.findMany({
    where: { customerId },
    include: {
      businessProfile: true,
      items: {
        include: {
          catalogItem: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  return orders;
};

export const checkEligibility = async (customerId, businessProfileId) => {
  if (!customerId || !businessProfileId) return false;
  
  const order = await prisma.orderEnquiry.findFirst({
    where: {
      customerId,
      businessProfileId,
      status: 'COMPLETED'
    }
  });

  return !!order;
};
