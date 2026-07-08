process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.WHATSAPP_ACCESS_TOKEN = ''; // deliberately unset so no real network call can happen

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCreateLead = jest.fn();
const mockUserFindUnique = jest.fn();
const mockCatalogItemFindUnique = jest.fn();
const mockBusinessProfileFindMany = jest.fn();
const mockOrderEnquiryFindUnique = jest.fn();
const mockSendRFQNotification = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: {
    user: { findUnique: mockUserFindUnique },
    catalogItem: { findUnique: mockCatalogItemFindUnique },
    businessProfile: { findMany: mockBusinessProfileFindMany },
    orderEnquiry: { findUnique: mockOrderEnquiryFindUnique },
  },
}));

jest.unstable_mockModule('../../../services/catalog.service.js', () => ({
  createLead: mockCreateLead,
  createCatalogItem: jest.fn(),
  getCatalogItemsByBusiness: jest.fn(),
  exploreCatalogItems: jest.fn(),
  getCatalogItemById: jest.fn(),
  updateCatalogItem: jest.fn(),
  deleteCatalogItem: jest.fn(),
}));

jest.unstable_mockModule('../../../services/whatsapp.service.js', () => ({
  default: { sendRFQNotification: mockSendRFQNotification, sendOTPNotification: jest.fn() },
}));

jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'customer-1' }; next(); },
  optionalAuth: (req, res, next) => { req.user = { id: 'customer-1' }; next(); },
  restrictTo: () => (req, res, next) => next(),
}));

jest.unstable_mockModule('../../../middlewares/verifyBusinessOwnership.js', () => ({
  default: (req, res, next) => next(),
}));

jest.unstable_mockModule('../../../middlewares/multer.js', () => ({
  uploadMedia: { single: () => (req, res, next) => next() },
}));

const { default: prisma } = await import('../../../config/prisma.js');
const { default: catalogRoutes } = await import('../catalog.route.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/catalog', catalogRoutes);
  return app;
}

describe('Lead creation journey: POST /catalog/enquire (smoke)', () => {
  beforeEach(() => {
    mockCreateLead.mockReset();
    mockSendRFQNotification.mockReset();
    mockUserFindUnique.mockReset();
    mockCatalogItemFindUnique.mockReset();
    mockBusinessProfileFindMany.mockReset().mockResolvedValue([]); // caller owns no businesses (not a self-booking)
    mockOrderEnquiryFindUnique.mockReset();
  });

  test('creates a lead for a phone-verified customer, returns 201, and stays 201 even if the fire-and-forget WhatsApp notification fails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'customer-1', isPhoneVerified: true, phoneNumber: '9999999999' });
    prisma.catalogItem.findUnique.mockResolvedValue({ id: 'item-1', businessProfileId: 'biz-1', price: 100 });
    mockCreateLead.mockResolvedValue({ id: 'lead-1' });
    prisma.orderEnquiry.findUnique.mockResolvedValue({
      id: 'lead-1',
      customerName: 'Jane',
      serviceLocation: 'Karnal',
      items: [{ catalogItem: { title: 'Haircut' } }],
      businessProfile: { id: 'biz-1', businessName: 'Test Salon', user: { phoneNumber: '8888888888' } },
    });
    // Notification fails outright — per Batch 1's fire-and-forget contract, this
    // must never affect the customer-facing response.
    mockSendRFQNotification.mockRejectedValue(new Error('network down'));

    const app = buildApp();
    const res = await request(app)
      .post('/catalog/enquire')
      .send({ catalogItemId: 'item-1', customerName: 'Jane', customerPhone: '9812345670' });

    expect(res.status).toBe(201);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
  });

  test('rejects the enquiry when the customer has not verified their phone', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'customer-1', isPhoneVerified: false });

    const app = buildApp();
    const res = await request(app)
      .post('/catalog/enquire')
      .send({ catalogItemId: 'item-1', customerName: 'Jane', customerPhone: '9812345670' });

    expect(res.status).toBe(403);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  test('rejects an enquiry with no catalogItemId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'customer-1', isPhoneVerified: true, phoneNumber: '9999999999' });

    const app = buildApp();
    const res = await request(app)
      .post('/catalog/enquire')
      .send({ customerName: 'Jane', customerPhone: '9812345670' });

    expect(res.status).toBe(400);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });
});
