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
    price: req.body.price ? parseFloat(req.body.price) : undefined,
    isActive: req.body.isActive === 'true' || req.body.isActive === true
  };

  const item = await catalogService.createCatalogItem(payload);
  
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: item
  });
});

export const getVendorCatalog = catchAsync(async (req, res) => {
  const items = await catalogService.getCatalogItemsByVendor(req.params.vendorId);
  
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

export const enquireCatalogItem = catchAsync(async (req, res) => {
  let { catalogItemId, customerName, customerPhone, customerRequirement } = req.body;

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

  let itemVendorId = null;

  if (!catalogItemId) {
    // Fallback to hyperlocal-general-services
    const generalVendor = await prisma.vendor.findUnique({
      where: { slug: 'hyperlocal-general-services' },
      include: { catalogItems: true },
    });
    
    if (generalVendor && generalVendor.catalogItems.length > 0) {
      catalogItemId = generalVendor.catalogItems[0].id;
      itemVendorId = generalVendor.id;
    } else {
      throw new AppError(StatusCodes.NOT_FOUND, 'No service providers available, including fallback', true);
    }
  } else {
    // Fetch item to get vendorId
    const item = await prisma.catalogItem.findUnique({ where: { id: catalogItemId } });
    if (!item) throw new AppError(StatusCodes.NOT_FOUND, 'Service not found', true);
    itemVendorId = item.vendorId;
  }

  // Walled Garden: Self-booking patch
  if (req.user && req.user.vendorId && req.user.vendorId === itemVendorId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot enquire about your own services.', true);
  }

  const lead = await catalogService.createLead({
    catalogItemId,
    customerName,
    customerPhone,
    customerRequirement
  });

  // Fetch full details of lead to get vendor's user phone number and catalog item title
  const leadDetails = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      catalogItem: true,
      vendor: {
        include: {
          user: true
        }
      }
    }
  });

  if (leadDetails) {
    const vendorPhone = leadDetails.vendor?.user?.phoneNumber || '9999999999';
    const customerName = leadDetails.customerName;
    const itemTitle = leadDetails.catalogItem?.title || 'General Service';
    const requirement = leadDetails.customerRequirement || 'None';
    
    const message = `🚨 New HyperLocal Lead! ${customerName} is looking for '${itemTitle}'. Requirement: ${requirement}. Login to your dashboard to respond: http://localhost:3000/vendor-dashboard`;

    if (vendorPhone) {
      // Trigger asynchronously so it does not block the API response
      sendWhatsAppNotification(vendorPhone, message).catch((err) => {
        console.error('Failed to send WhatsApp notification:', err);
      });
    }
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    message: 'Inquiry sent directly to the vendor!',
    data: lead
  });
});

export const updateCatalogItem = catchAsync(async (req, res) => {
  const { id } = req.params;

  const userVendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id }
  });
  if (!userVendor && req.user.role !== 'admin') {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not have a vendor profile', true);
  }
  const vendorId = req.user.role === 'admin' ? 'ADMIN' : userVendor.id;

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

  delete payload.vendorId;

  const item = await catalogService.updateCatalogItem(id, vendorId, payload);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: item
  });
});

export const deleteCatalogItem = catchAsync(async (req, res) => {
  const { id } = req.params;

  const userVendor = await prisma.vendor.findUnique({
    where: { userId: req.user.id }
  });
  if (!userVendor && req.user.role !== 'admin') {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not have a vendor profile', true);
  }
  const vendorId = req.user.role === 'admin' ? 'ADMIN' : userVendor.id;

  await catalogService.deleteCatalogItem(id, vendorId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Catalog item deleted successfully'
  });
});
