process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
  },
}));

jest.unstable_mockModule('../email.service.js', () => ({
  default: { sendPasswordResetEmail: jest.fn().mockResolvedValue(true) },
}));

const { emailRegister, emailLogin, checkExistence } = await import('../auth.service.js');

describe('Authentication journey (smoke)', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockReset();
  });

  describe('emailRegister', () => {
    test('registers a new customer and returns a token', async () => {
      mockFindUnique.mockResolvedValue(null); // no existing email/phone
      mockCreate.mockResolvedValue({
        id: 'user-1', email: 'new@example.com', name: 'New User', role: 'customer',
        hasVendorProfile: false, hasCustomerProfile: true, phoneNumber: null, dateOfBirth: null,
      });

      const result = await emailRegister({ email: 'new@example.com', password: 'password123', name: 'New User', role: 'customer' });

      expect(result.token).toBeTruthy();
      expect(result.user.role).toBe('customer');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('rejects registration with an already-registered email', async () => {
      mockFindUnique.mockResolvedValueOnce({ id: 'existing-user' }); // email lookup hits

      await expect(
        emailRegister({ email: 'taken@example.com', password: 'password123', name: 'Someone' })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('rejects a vendor registration without a phone number', async () => {
      await expect(
        emailRegister({ email: 'vendor@example.com', password: 'password123', name: 'Vendor', role: 'vendor' })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('emailLogin', () => {
    test('logs in with correct credentials and returns a token', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const passwordHash = await bcrypt.hash('password123', 12);
      mockFindUnique.mockResolvedValue({
        id: 'user-1', email: 'user@example.com', passwordHash, isBanned: false,
        role: 'customer', name: 'User', hasVendorProfile: false, hasCustomerProfile: true,
      });

      const result = await emailLogin({ identifier: 'user@example.com', password: 'password123' });

      expect(result.token).toBeTruthy();
      expect(result.message).toBe('Login successful');
    });

    test('rejects an incorrect password', async () => {
      const bcrypt = (await import('bcryptjs')).default;
      const passwordHash = await bcrypt.hash('correct-password', 12);
      mockFindUnique.mockResolvedValue({
        id: 'user-1', email: 'user@example.com', passwordHash, isBanned: false, role: 'customer',
      });

      await expect(
        emailLogin({ identifier: 'user@example.com', password: 'wrong-password' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('rejects login for a banned account', async () => {
      mockFindUnique.mockResolvedValue({ id: 'user-1', email: 'banned@example.com', passwordHash: 'x', isBanned: true });

      await expect(
        emailLogin({ identifier: 'banned@example.com', password: 'whatever' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('rejects login for a non-existent account', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        emailLogin({ identifier: 'nobody@example.com', password: 'whatever' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('checkExistence', () => {
    test('reports exists:true for a known email', async () => {
      mockFindUnique.mockResolvedValue({ isBanned: false, hasCustomerProfile: true, hasVendorProfile: false, role: 'customer' });
      const result = await checkExistence('user@example.com');
      expect(result.exists).toBe(true);
    });

    test('reports exists:false for an unknown identifier', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await checkExistence('nobody@example.com');
      expect(result.exists).toBe(false);
    });
  });
});
