import { StatusCodes } from 'http-status-codes';
import * as catalogService from '../services/catalog.service.js';
import catchAsync from '../utils/catchAsync.js';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import { sendWhatsAppNotification } from '../utils/whatsapp.util.js';

export const createCatalogItem = catchAsync(async (req, res) => {
  let mediaUrl = undefined;
  
  if (req.file) {
    mediaUrl = req.file.path; // Cloudinary secure_url attached by Multer
  } else if (req.body.mediaUrl) {
    mediaUrl = req.body.mediaUrl;
  }

  const payload = {
    ...req.body,
    mediaUrl,
    businessProfileId: req.business.id,
    price: req.body.price ? parseFloat(req.body.price) : undefined,
    isActive: req.body.isActive === 'true' || req.body.isActive === true,
    isAvailable: req.body.isAvailable !== undefined ? (req.body.isAvailable === 'true' || req.body.isAvailable === true) : undefined,
    isVeg: req.body.isVeg !== undefined ? (req.body.isVeg === 'true' || req.body.isVeg === true) : undefined,
    variants: req.body.variants && typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants,
    unit: req.body.unit || undefined
  };

  const item = await catalogService.createCatalogItem(payload);
  
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: item
  });
});

export const getBusinessCatalog = catchAsync(async (req, res) => {
  const items = await catalogService.getCatalogItemsByBusiness(req.params.businessId);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: items
  });
});

export const exploreCatalogItems = catchAsync(async (req, res) => {
  const filters = {
    citySlug: req.query.citySlug,
    categorySlug: req.query.categorySlug,
    searchQuery: req.query.searchQuery,
    page: req.query.page ? parseInt(req.query.page) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };

  const result = await catalogService.exploreCatalogItems(filters);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: result.items,
    pagination: result.pagination
  });
});

export const getCatalogItemById = catchAsync(async (req, res) => {
  const item = await catalogService.getCatalogItemById(req.params.id);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: item
  });
});

export const enquireCatalogItem = catchAsync(async (req, res) => {
  if (!req.user) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'You must be logged in to book a service.', true);
  }

  // Enforce Phone Verification
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.isPhoneVerified) {
    const err = new AppError(StatusCodes.FORBIDDEN, 'Your phone number is not verified. Please verify your phone number in your profile to continue.', true);
    err.code = 'PHONE_NOT_VERIFIED';
    throw err;
  }

  let { catalogItemId, customerName, customerPhone, customerRequirement } = req.body;

  // Use the verified phone number instead of relying on the client
  if (!customerPhone && user.phoneNumber) {
    customerPhone = user.phoneNumber;
  }

  // Lightweight validation for junk phone numbers
  if (customerPhone) {
    if (/^(\d)\1{9}$/.test(customerPhone)) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Please enter a valid phone number. Repeating digits are not allowed.', true);
    }
    const sequential = ['0123456789', '1234567890', '9876543210'];
    if (sequential.includes(customerPhone)) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Please enter a valid phone number. Sequential digits are not allowed.', true);
    }
  }

  let itemBusinessId = null;

  if (!catalogItemId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Catalog Item ID is required', true);
  } else {
    // Fetch item to get businessProfileId
    const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
    if (!item) throw new AppError(StatusCodes.NOT_FOUND, 'Service not found', true);
    itemBusinessId = item.businessProfileId;
  }

  // Walled Garden: Self-booking patch
  const userBusinesses = await prisma.businessProfile.findMany({ where: { userId: req.user.id } });
  const isOwner = userBusinesses.some(b => b.id === itemBusinessId);
  if (isOwner) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot enquire about your own services.', true);
  }

  const lead = await catalogService.createLead({
    catalogItemId,
    customerName,
    customerPhone,
    customerRequirement
  });

  // Fetch full details of lead to get business owner phone number
  const leadDetails = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      catalogItem: true,
      businessProfile: {
        include: {
          user: true
        }
      }
    }
  });

  if (leadDetails) {
    const businessPhone = leadDetails.businessProfile?.user?.phoneNumber || '9999999999';
    const customerName = leadDetails.customerName;
    const itemTitle = leadDetails.catalogItem?.title || 'General Service';
    const requirement = leadDetails.customerRequirement || 'None';
    
    const message = `🚨 New NearByBazar Lead! ${customerName} is looking for '${itemTitle}'. Requirement: ${requirement}. Login to your dashboard to respond: http://localhost:3000/vendor-dashboard`;

    if (businessPhone) {
      // Trigger asynchronously so it does not block the API response
      sendWhatsAppNotification(businessPhone, message).catch((err) => {
        console.error('Failed to send WhatsApp notification:', err);
      });
    }
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Inquiry sent directly to the business!',
    data: lead
  });
});

export const updateCatalogItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  const businessId = req.business.id; // From verifyBusinessOwnership middleware

  let mediaUrl = undefined;
  if (req.file) {
    mediaUrl = req.file.path;
  } else if (req.body.mediaUrl) {
    mediaUrl = req.body.mediaUrl;
  }

  const payload = {
    ...req.body,
    ...(mediaUrl && { mediaUrl }),
  };

  if (payload.price !== undefined && payload.price !== '') {
    payload.price = parseFloat(payload.price);
  } else {
    delete payload.price;
  }

  if (payload.isActive !== undefined) {
    payload.isActive = payload.isActive === 'true' || payload.isActive === true;
  }
  
  if (payload.isAvailable !== undefined) {
    payload.isAvailable = payload.isAvailable === 'true' || payload.isAvailable === true;
  }
  
  if (payload.isVeg !== undefined) {
    payload.isVeg = payload.isVeg === 'true' || payload.isVeg === true;
  }

  if (payload.variants && typeof payload.variants === 'string') {
    try {
      payload.variants = JSON.parse(payload.variants);
    } catch(e) {}
  }

  delete payload.businessProfileId;

  const item = await catalogService.updateCatalogItem(id, businessId, payload);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: item
  });
});

export const deleteCatalogItem = catchAsync(async (req, res) => {
  const { id } = req.params;
  const businessId = req.business.id;

  await catalogService.deleteCatalogItem(id, businessId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Catalog item deleted successfully'
  });
});
