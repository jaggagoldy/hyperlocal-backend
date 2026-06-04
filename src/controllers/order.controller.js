import { StatusCodes } from 'http-status-codes';
import { processCheckout, getMyOrders } from '../services/order.service.js';
import catchAsync from '../utils/catchAsync.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.util.js';

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

  // Get vendor's user phone number
  const vendorPhone = order.vendor?.user?.phoneNumber;
  
  if (vendorPhone) {
    // Fire and forget (or await)
    await sendWhatsAppNotification(vendorPhone, waMessage);
  } else {
    // Fallback log
    console.warn(`Could not send WhatsApp to Vendor ${order.vendor.id} - No phone number found.`);
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: order
  });
});

export const getMyOrdersController = catchAsync(async (req, res) => {
  const customerId = req.user?.id;
  const orders = await getMyOrders(customerId);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: orders
  });
});

export const checkEligibilityController = catchAsync(async (req, res) => {
  const customerId = req.user?.id;
  const { vendorId } = req.query;
  
  if (!vendorId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'vendorId is required'
    });
  }

  // Assuming checkEligibility is implemented in order.service.js, but we can do a direct prisma call if simpler,
  // or we'll just implement checkEligibility in order.service.js
  const isEligible = await import('../services/order.service.js').then(m => m.checkEligibility(customerId, vendorId));
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { eligible: isEligible }
  });
});
