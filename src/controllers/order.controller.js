import { StatusCodes } from 'http-status-codes';
import { processCheckout, getMyOrders } from '../services/order.service.js';
import catchAsync from '../utils/catchAsync.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.util.js';
import AppError from '../utils/AppError.js';

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

  // Format WhatsApp Template
  let waMessage = `*New ${order.orderType === 'BOOKING' ? 'Booking Request' : 'Order'} on NearByBazar!*\n\n`;
  waMessage += `👤 *Customer:* ${order.customerName}\n`;
  waMessage += `📞 *Phone:* ${order.customerPhone}\n`;

  if (order.orderType === 'BOOKING' && order.scheduledAt) {
    waMessage += `🗓 *Scheduled For:* ${new Date(order.scheduledAt).toLocaleString()}\n`;
  }
  if (order.serviceLocation) {
    waMessage += `📍 *Location:* ${order.serviceLocation}\n`;
  }

  waMessage += `\n*Details:*\n`;
  let truncatedCount = 0;
  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const itemLine = `- ${item.quantity}x ${item.catalogItem.title}\n`;
    if (waMessage.length + itemLine.length > 3800) {
      truncatedCount = order.items.length - i;
      waMessage += `...and ${truncatedCount} more items. View full details on platform.\n`;
      break;
    }
    waMessage += itemLine;
  }

  waMessage += `\n💰 *Total Value:* ₹${order.totalValue}\n`;

  // Get business owner's user phone number
  const businessPhone = order.businessProfile?.user?.phoneNumber;
  
  if (businessPhone) {
    // Fire and forget (or await)
    await sendWhatsAppNotification(businessPhone, waMessage);
  } else {
    // Fallback log
    console.warn(`Could not send WhatsApp to Business ${order.businessProfile.id} - No phone number found.`);
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
