import { StatusCodes } from 'http-status-codes';
import { processCheckout, getMyOrders } from '../services/order.service.js';
import catchAsync from '../utils/catchAsync.js';
import WhatsAppService from '../services/whatsapp.service.js';
import AppError from '../errors/AppError.js';
import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

const sanitizeOrderPII = (order) => {
  if (order.status === 'PENDING') {
    if (order.customerPhone) {
      order.customerPhone = null;
    }
    if (order.businessProfile?.user?.phoneNumber) {
      order.businessProfile.user.phoneNumber = null;
    }
    if (order.customer?.phoneNumber) {
      order.customer.phoneNumber = null;
    }
  }
  return order;
};

export const checkout = catchAsync(async (req, res) => {
  const customerId = req.user?.id || null;
  const order = await processCheckout(req.body, customerId);

  // Notify the vendor over WhatsApp. Fire-and-forget so a slow/failed WhatsApp
  // API call never delays or fails the customer's checkout response.
  const businessPhone = order.businessProfile?.user?.phoneNumber;

  if (businessPhone) {
    const vendorName = order.businessProfile?.businessName || 'Vendor';
    const orderTypeLabel = order.orderType === 'BOOKING' ? 'Booking Request' : 'Order';
    const itemsSummary = order.items.map((item) => `${item.quantity}x ${item.catalogItem.title}`).join(', ');
    const serviceType = `${orderTypeLabel}: ${itemsSummary} (₹${order.totalValue})`.slice(0, 300);

    WhatsAppService.sendRFQNotification({ to: businessPhone, vendorName, serviceType })
      .then((result) => {
        if (!result.success) {
          logger.warn({ orderId: order.id, businessProfileId: order.businessProfile.id, error: result.error }, 'Vendor WhatsApp notification failed');
        }
      })
      .catch((err) => {
        logger.error({ orderId: order.id, businessProfileId: order.businessProfile.id, err: err.message }, 'Unhandled error sending vendor WhatsApp notification');
      });
  } else {
    logger.warn({ orderId: order.id, businessProfileId: order.businessProfile?.id }, 'Could not send WhatsApp notification - no phone number found for business');
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: sanitizeOrderPII(order)
  });
});

export const getMyOrdersController = catchAsync(async (req, res) => {
  const customerId = req.user?.id;
  const orders = await getMyOrders(customerId);
  
  const sanitizedOrders = orders.map(sanitizeOrderPII);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: sanitizedOrders
  });
});

export const checkEligibilityController = catchAsync(async (req, res) => {
  const customerId = req.user?.id;
  const { businessProfileId } = req.query;
  
  if (!businessProfileId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'businessProfileId is required'
    });
  }

  const isEligible = await import('../services/order.service.js').then(m => m.checkEligibility(customerId, businessProfileId));
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { eligible: isEligible }
  });
});

export const getVendorOrdersController = catchAsync(async (req, res) => {
  const businessId = req.business.id;

  const { getVendorOrders } = await import('../services/order.service.js');
  const orders = await getVendorOrders(businessId);

  const sanitizedOrders = orders.map(sanitizeOrderPII);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: sanitizedOrders
  });
});

export const updateOrderStatusController = catchAsync(async (req, res) => {
  const businessId = req.business.id;
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim() === '')) {
    throw new AppError('A valid rejection reason is required when rejecting an order/enquiry.', StatusCodes.BAD_REQUEST);
  }

  const { updateOrderStatus } = await import('../services/order.service.js');
  const updatedOrder = await updateOrderStatus(id, businessId, req.body);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: sanitizeOrderPII(updatedOrder)
  });
});

export const cancelOrderController = catchAsync(async (req, res) => {
  const customerId = req.user.id;
  const { id } = req.params;

  const { cancelOrder } = await import('../services/order.service.js');
  const cancelledOrder = await cancelOrder(id, customerId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: sanitizeOrderPII(cancelledOrder)
  });
});

export const getPendingRatingController = catchAsync(async (req, res) => {
  const customerId = req.user.id;
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  
  // Find completed orders within the last 5 hours
  const completedOrders = await prisma.orderEnquiry.findMany({
    where: {
      customerId,
      status: 'COMPLETED',
      updatedAt: {
        gte: fiveHoursAgo
      }
    },
    include: {
      businessProfile: {
        select: {
          id: true,
          businessName: true,
          media: {
            take: 1,
            select: { secureUrl: true }
          }
        }
      },
      items: {
        include: {
          catalogItem: {
            select: { title: true }
          }
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  // Filter out any orders that have already been reviewed
  const orderIds = completedOrders.map(o => o.id);
  const reviewed = await prisma.review.findMany({
    where: {
      orderId: { in: orderIds }
    },
    select: { orderId: true }
  });
  const reviewedIds = new Set(reviewed.map(r => r.orderId));

  const pendingRating = completedOrders.filter(o => !reviewedIds.has(o.id));

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: pendingRating
  });
});
