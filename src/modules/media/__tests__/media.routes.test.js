process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFindFirst = jest.fn();
const mockUploadVendorMedia = jest.fn();
const mockDeleteVendorMedia = jest.fn();

jest.unstable_mockModule('../../../config/prisma.js', () => ({
  default: { businessProfile: { findFirst: mockFindFirst } },
}));

jest.unstable_mockModule('../../../services/media.service.js', () => ({
  uploadVendorMedia: mockUploadVendorMedia,
  deleteVendorMedia: mockDeleteVendorMedia,
}));

// Stub auth so the test controls req.user directly via a header, instead of a real JWT.
jest.unstable_mockModule('../../../middlewares/auth.middleware.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || 'no-user', role: 'vendor' };
    next();
  },
  restrictTo: () => (req, res, next) => next(),
}));

// Stub multer so the test can post a plain JSON body instead of multipart/form-data.
jest.unstable_mockModule('../../../middlewares/multer.js', () => ({
  uploadMedia: { single: () => (req, res, next) => { req.file = { buffer: Buffer.from('fake') }; next(); } },
}));

const { default: mediaRoutes } = await import('../media.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/media', mediaRoutes);
  return app;
}

describe('media routes ownership enforcement (Batch 2 P0: media IDOR fix)', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUploadVendorMedia.mockReset();
    mockDeleteVendorMedia.mockReset();
  });

  test('POST /media/upload is rejected (403) for a business the caller does not own, and never reaches the service', async () => {
    mockFindFirst.mockResolvedValue(null); // caller does not own 'victim-business'
    const app = buildApp();

    const res = await request(app)
      .post('/media/upload')
      .set('x-test-user-id', 'attacker')
      .send({ vendorId: 'victim-business', type: 'profile_image' });

    expect(res.status).toBe(403);
    expect(mockUploadVendorMedia).not.toHaveBeenCalled();
  });

  test('POST /media/upload succeeds for a business the caller owns, using the verified id (not the raw body value)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'my-business', userId: 'owner' });
    mockUploadVendorMedia.mockResolvedValue({ id: 'media-1' });
    const app = buildApp();

    const res = await request(app)
      .post('/media/upload')
      .set('x-test-user-id', 'owner')
      .send({ vendorId: 'my-business', type: 'profile_image' });

    expect(res.status).toBe(201);
    expect(mockUploadVendorMedia).toHaveBeenCalledWith('my-business', 'profile_image', expect.anything());
  });

  test('POST /media/delete is rejected (403) for a business the caller does not own, and never reaches the service', async () => {
    mockFindFirst.mockResolvedValue(null);
    const app = buildApp();

    const res = await request(app)
      .post('/media/delete')
      .set('x-test-user-id', 'attacker')
      .send({ mediaId: 'm1', vendorId: 'victim-business' });

    expect(res.status).toBe(403);
    expect(mockDeleteVendorMedia).not.toHaveBeenCalled();
  });

  test('POST /media/delete succeeds for a business the caller owns', async () => {
    mockFindFirst.mockResolvedValue({ id: 'my-business', userId: 'owner' });
    mockDeleteVendorMedia.mockResolvedValue({ message: 'Media successfully deleted' });
    const app = buildApp();

    const res = await request(app)
      .post('/media/delete')
      .set('x-test-user-id', 'owner')
      .send({ mediaId: 'm1', vendorId: 'my-business' });

    expect(res.status).toBe(200);
    expect(mockDeleteVendorMedia).toHaveBeenCalledWith('m1', 'my-business');
  });
});
