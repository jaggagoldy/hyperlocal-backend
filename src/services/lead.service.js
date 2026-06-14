import prisma from '../config/prisma.js';
import { z } from 'zod';
import AppError from '../errors/AppError.js';
import { StatusCodes } from 'http-status-codes';

export const getVendorLeads = async (businessProfileId) => {
  if (!businessProfileId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Business Profile ID is required', true);
  }

  const orders = await prisma.orderEnquiry.findMany({
    where: { businessProfileId },
    include: {
      items: {
        include: { catalogItem: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return orders.map(order => ({
    id: order.id,
    businessProfileId: order.businessProfileId,
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    status: order.status === 'PENDING' ? 'NEW' : (order.status === 'CONFIRMED' ? 'CONTACTED' : (order.status === 'COMPLETED' ? 'CONVERTED' : order.status)),
    createdAt: order.createdAt,
    catalogItem: order.items[0]?.catalogItem || { title: order.orderType, price: order.totalValue },
    totalValue: order.totalValue,
    serviceLocation: order.serviceLocation,
    scheduledAt: order.scheduledAt
  }));
};

export const updateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED']),
});

export const updateLeadStatus = async (leadId, businessProfileId, data) => {
  const parsed = updateLeadStatusSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(StatusCodes.BAD_REQUEST, parsed.error.issues?.[0]?.message || 'Invalid input', true);
  }

  const order = await prisma.orderEnquiry.findUnique({
    where: { id: leadId },
  });

  if (!order) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Lead not found', true);
  }

  if (order.businessProfileId !== businessProfileId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not have permission to update this lead', true);
  }

  const statusMap = {
    'NEW': 'PENDING',
    'CONTACTED': 'CONFIRMED',
    'CONVERTED': 'COMPLETED',
    'REJECTED': 'REJECTED'
  };

  const updatedOrder = await prisma.orderEnquiry.update({
    where: { id: leadId },
    data: { status: statusMap[parsed.data.status] || 'PENDING' },
    include: {
      items: {
        include: { catalogItem: true }
      }
    }
  });

  return {
    id: updatedOrder.id,
    status: parsed.data.status,
    catalogItem: updatedOrder.items[0]?.catalogItem || { title: updatedOrder.orderType, price: updatedOrder.totalValue }
  };
};
