process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockProcessCheckout = jest.fn();
const mockSendRFQNotification = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: { orderEnquiry: { findMany: jest.fn() }, review: { findMany: jest.fn() } },
}));

jest.unstable_mockModule('../../../services/order.service.js', () => ({
  processCheckout: mockProcessCheckout,
  getMyOrders: jest.fn(),
  checkEligibility: jest.fn(),
  getVendorOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  cancelOrder: jest.fn(),
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

const { default: orderRoutes } = await import('../order.route.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/orders', orderRoutes);
  return app;
}

describe('Order enquiry journey: POST /orders/checkout (smoke)', () => {
  beforeEach(() => {
    mockProcessCheckout.mockReset();
    mockSendRFQNotification.mockReset();
  });

  test('checks out successfully and returns the sanitized order', async () => {
    mockProcessCheckout.mockResolvedValue({
      id: 'order-1',
      orderType: 'BOOKING',
      status: 'PENDING',
      customerName: 'Jane',
      customerPhone: '9812345670',
      totalValue: 500,
      items: [{ quantity: 2, catalogItem: { title: 'Haircut' } }],
      businessProfile: { id: 'biz-1', businessName: 'Test Salon', user: { phoneNumber: '8888888888' } },
    });
    mockSendRFQNotification.mockResolvedValue({ success: true, messageId: 'wamid.1' });

    const app = buildApp();
    const res = await request(app)
      .post('/orders/checkout')
      .send({ businessProfileId: 'biz-1', orderType: 'BOOKING', customerName: 'Jane', customerPhone: '9812345670', items: [] });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('order-1');
    // PENDING orders have PII redacted in the response (existing sanitizeOrderPII behavior).
    expect(res.body.data.customerPhone).toBeNull();
  });

  test('checkout succeeds even when the vendor WhatsApp notification fails (fire-and-forget, Batch 1 contract)', async () => {
    mockProcessCheckout.mockResolvedValue({
      id: 'order-2',
      orderType: 'ORDER',
      status: 'PENDING',
      customerName: 'Jane',
      customerPhone: '9812345670',
      totalValue: 250,
      items: [{ quantity: 1, catalogItem: { title: 'Pizza' } }],
      businessProfile: { id: 'biz-1', businessName: 'Test Diner', user: { phoneNumber: '8888888888' } },
    });
    mockSendRFQNotification.mockRejectedValue(new Error('Meta API down'));

    const app = buildApp();
    const res = await request(app)
      .post('/orders/checkout')
      .send({ businessProfileId: 'biz-1', orderType: 'ORDER', customerName: 'Jane', customerPhone: '9812345670', items: [] });

    expect(res.status).toBe(201);
  });

  test('does not notify (and does not error) when the business has no phone on file', async () => {
    mockProcessCheckout.mockResolvedValue({
      id: 'order-3',
      orderType: 'ORDER',
      status: 'PENDING',
      customerName: 'Jane',
      customerPhone: '9812345670',
      totalValue: 100,
      items: [{ quantity: 1, catalogItem: { title: 'Item' } }],
      businessProfile: { id: 'biz-2', businessName: 'No Phone Biz', user: { phoneNumber: null } },
    });

    const app = buildApp();
    const res = await request(app)
      .post('/orders/checkout')
      .send({ businessProfileId: 'biz-2', orderType: 'ORDER', customerName: 'Jane', customerPhone: '9812345670', items: [] });

    expect(res.status).toBe(201);
    expect(mockSendRFQNotification).not.toHaveBeenCalled();
  });
});
