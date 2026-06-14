import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import prisma from '../../config/prisma.js';
import AppError from '../../errors/AppError.js';

export const getDashboardMetricsController = catchAsync(async (req, res) => {
  const activeVendors = await prisma.businessProfile.count({ where: { status: 'available' } });
  const totalConsumers = await prisma.user.count({ where: { role: 'customer' } });
  
  // Leads this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const leadsThisWeek = await prisma.orderEnquiry.count({
    where: { orderType: 'SERVICE_BOOKING', createdAt: { gte: oneWeekAgo } }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      activeVendors,
      totalConsumers,
      leadsThisWeek
    }
  });
});

export const getVendorsController = catchAsync(async (req, res) => {
  const vendors = await prisma.businessProfile.findMany({
    include: {
      user: { select: { phoneNumber: true, email: true } },
      categories: { include: { category: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendors
  });
});

export const getUsersController = catchAsync(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: 'customer' },
    orderBy: { createdAt: 'desc' }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: users
  });
});

export const banUserController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isBanned } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { isBanned }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: user
  });
});

export const suspendVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'suspended', 'available', 'banned'

  const vendor = await prisma.businessProfile.update({
    where: { id },
    data: { status }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendor
  });
});

export const getModerationQueueController = catchAsync(async (req, res) => {
  const queue = await prisma.feedback.findMany({
    where: { type: 'Report', status: 'pending' },
    orderBy: { createdAt: 'desc' }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: queue
  });
});

export const verifyVendorIdController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { idVerified } = req.body;

  const vendor = await prisma.businessProfile.update({
    where: { id },
    data: { idVerified }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendor
  });
});

export const featureVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isFeatured } = req.body;

  const vendor = await prisma.businessProfile.update({
    where: { id },
    data: { isFeatured }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendor
  });
});

export const getTicketsController = catchAsync(async (req, res) => {
  const tickets = await prisma.feedback.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Attach users or vendors if needed manually or just display what we have
  // In a real app, we might add a relation to Feedback for User

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: tickets
  });
});

export const resolveTicketController = catchAsync(async (req, res) => {
  const { id } = req.params;

  const ticket = await prisma.feedback.update({
    where: { id },
    data: { status: 'resolved' }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: ticket
  });
});

export const getCategoryAnalyticsController = catchAsync(async (req, res) => {
  // Aggregate leads by category using catalogItem (OrderItem groups by catalogItemId)
  const categoryLeads = await prisma.orderItem.groupBy({
    by: ['catalogItemId'],
    _count: {
      id: true,
    },
  });

  // For simplicity, we just fetch categories and counts
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { catalogItems: true, vendors: true }
      }
    }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      categories,
      leadStats: categoryLeads.map(item => ({
        catalogItemId: item.catalogItemId,
        _count: { id: item._count.id }
      }))
    }
  });
});

export const getLeadsController = catchAsync(async (req, res) => {
  const orders = await prisma.orderEnquiry.findMany({
    where: { orderType: 'SERVICE_BOOKING' },
    include: {
      items: {
        include: {
          catalogItem: true
        }
      },
      businessProfile: {
        select: {
          businessName: true,
          user: { select: { phoneNumber: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const leads = orders.map(order => ({
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerRequirement: order.serviceLocation || '',
    status: order.status === 'PENDING' ? 'NEW' : (order.status === 'CONFIRMED' ? 'CONTACTED' : (order.status === 'COMPLETED' ? 'CONVERTED' : order.status)),
    createdAt: order.createdAt,
    catalogItem: order.items[0]?.catalogItem || null,
    vendor: order.businessProfile || { businessName: 'Unknown Vendor', user: { phoneNumber: '9999999999' } }
  }));

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: leads
  });
});
