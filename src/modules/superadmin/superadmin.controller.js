import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import prisma from '../../config/prisma.js';
import AppError from '../../errors/AppError.js';
import logger from '../../config/logger.js';
import { getVerificationQueue, reviewVerificationRequest } from '../../services/business.service.js';
import { getReviewModerationQueue, hideReview, restoreReview } from '../../services/review.service.js';
import WhatsAppService from '../../services/whatsapp.service.js';
import { recordAuditLog, getAuditLog } from '../../services/auditLog.service.js';

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

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isBanned } });
    await recordAuditLog(tx, {
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: isBanned ? 'USER_BANNED' : 'USER_UNBANNED',
      entityType: 'User',
      entityId: id,
      metadata: { isBanned },
    });
    return updated;
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: user
  });
});

export const suspendVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'suspended', 'available', 'banned'

  const vendor = await prisma.$transaction(async (tx) => {
    const updated = await tx.businessProfile.update({ where: { id }, data: { status } });
    await recordAuditLog(tx, {
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: 'VENDOR_STATUS_CHANGED',
      entityType: 'BusinessProfile',
      entityId: id,
      metadata: { status },
    });
    return updated;
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

// Sprint 2 Batch 5 — a focused view of the moderation queue scoped to
// review reports specifically, with the reported review's own content
// included (the generic queue above stays as-is for non-review reports).
export const getReviewModerationQueueController = catchAsync(async (req, res) => {
  const queue = await getReviewModerationQueue();

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: queue
  });
});

export const hideReviewController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const review = await hideReview(id, { actorId: req.user?.id, actorRole: req.user?.role }, reason);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: review
  });
});

export const restoreReviewController = catchAsync(async (req, res) => {
  const { id } = req.params;

  const review = await restoreReview(id, { actorId: req.user?.id, actorRole: req.user?.role });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: review
  });
});

export const verifyVendorIdController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { idVerified } = req.body;

  // Manual emergency override — audited the same as the real workflow below,
  // since this bypasses the Business Readiness gate entirely and should leave
  // just as clear a trail (arguably a more important one to have).
  const vendor = await prisma.$transaction(async (tx) => {
    const updated = await tx.businessProfile.update({ where: { id }, data: { idVerified } });
    await recordAuditLog(tx, {
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: 'VENDOR_ID_VERIFIED_MANUAL_OVERRIDE',
      entityType: 'BusinessProfile',
      entityId: id,
      metadata: { idVerified },
    });
    return updated;
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendor
  });
});

// Sprint 2 Batch 2 — real verification workflow. verifyVendorIdController above
// remains as a manual emergency override; this is the normal path.
export const getVerificationQueueController = catchAsync(async (req, res) => {
  const queue = await getVerificationQueue();

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: queue
  });
});

export const reviewVerificationController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  const business = await reviewVerificationRequest(id, decision, rejectionReason, {
    actorId: req.user?.id,
    actorRole: req.user?.role,
  });

  // Notify the vendor of the outcome. Fire-and-forget, matching the
  // fire-and-forget contract established for vendor notifications in Sprint 1
  // Batch 1 — a failed notification must never affect the review decision
  // that already succeeded and was persisted above.
  const vendorPhone = business.user?.phoneNumber;
  if (vendorPhone) {
    const statusMessage =
      decision === 'APPROVED'
        ? 'Verification Approved ✅'
        : `Verification Not Approved: ${rejectionReason}`;

    // Reuses the one approved-shape template (vendorName + a short message) —
    // same pragmatic reuse pattern as the order-checkout notification in
    // Sprint 1 Batch 1. A dedicated verification-status template would carry
    // richer content but requires its own Meta approval; not assumed here.
    WhatsAppService.sendRFQNotification({
      to: vendorPhone,
      vendorName: business.businessName,
      serviceType: statusMessage,
    }).then((result) => {
      if (!result.success) {
        logger.warn({ businessId: business.id, decision, error: result.error }, 'Vendor verification-outcome WhatsApp notification failed');
      }
    }).catch((err) => {
      logger.error({ businessId: business.id, decision, err: err.message }, 'Unhandled error sending verification-outcome WhatsApp notification');
    });
  } else {
    logger.warn({ businessId: business.id, decision }, 'Could not send verification-outcome notification - no phone number found for business');
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: business
  });
});

export const featureVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isFeatured } = req.body;

  const vendor = await prisma.$transaction(async (tx) => {
    const updated = await tx.businessProfile.update({ where: { id }, data: { isFeatured } });
    await recordAuditLog(tx, {
      actorId: req.user?.id,
      actorRole: req.user?.role,
      action: isFeatured ? 'VENDOR_FEATURED' : 'VENDOR_UNFEATURED',
      entityType: 'BusinessProfile',
      entityId: id,
      metadata: { isFeatured },
    });
    return updated;
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

export const editVendorController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Filter out fields that shouldn't be updated directly via this generic endpoint
  const allowedUpdates = ['businessName', 'localityName', 'chowkLandmark', 'pincode', 'membershipTier', 'listingTier', 'status'];
  
  const data = {};
  for (const key of allowedUpdates) {
    if (updateData[key] !== undefined) {
      data[key] = updateData[key];
    }
  }

  const vendor = await prisma.businessProfile.update({
    where: { id },
    data
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: vendor
  });
});

export const getAuditLogController = catchAsync(async (req, res) => {
  const { entityType, entityId, actorId } = req.query;
  const entries = await getAuditLog({ entityType, entityId, actorId });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: entries
  });
});

export const getSettingsController = catchAsync(async (req, res) => {
  const settings = await prisma.systemSetting.findMany();
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: settings
  });
});

export const updateSettingsController = catchAsync(async (req, res) => {
  const { key, value, description } = req.body;
  
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value, description },
    create: { key, value, description }
  });

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: setting
  });
});
