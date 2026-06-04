import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email format').optional(),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number format').optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.null()).or(z.literal('')),
  gender: z.string().optional().or(z.null()).or(z.literal('')),
  address: z.string().optional().or(z.null()).or(z.literal('')),
  hasCustomerProfile: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

const verifyPassword = (password, storedPasswordHash) => {
  const [salt, hash] = storedPasswordHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const updateProfile = async (userId, data) => {
  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { name, email, phoneNumber, dateOfBirth, gender, address, hasCustomerProfile } = parsed.data;

  // Check unique constraints if updating email/phone
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      throw new AppError(StatusCodes.CONFLICT, 'Email already in use', true);
    }
  }

  let phoneVal = phoneNumber || null;
  if (phoneVal === '') phoneVal = null;
  if (phoneVal) {
    const existing = await prisma.user.findUnique({ where: { phoneNumber: phoneVal } });
    if (existing && existing.id !== userId) {
      throw new AppError(StatusCodes.CONFLICT, 'Phone number already in use', true);
    }
  }

  let dobVal = dateOfBirth ? new Date(dateOfBirth) : null;
  if (dobVal && isNaN(dobVal.getTime())) dobVal = null;

  let genderVal = gender || null;
  if (genderVal === '') genderVal = null;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      phoneNumber: phoneVal,
      dateOfBirth: dobVal,
      gender: genderVal,
      ...(address !== undefined && { address }),
      ...(hasCustomerProfile !== undefined && { hasCustomerProfile })
    },
    select: { id: true, name: true, email: true, phoneNumber: true, role: true, dateOfBirth: true, gender: true, hasCustomerProfile: true, address: true }
  });

  return updatedUser;
};

export const changePassword = async (userId, data) => {
  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues?.[0]?.message || 'Invalid input';
    throw new AppError(StatusCodes.BAD_REQUEST, errorMsg, true);
  }

  const { oldPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Cannot change password. Account might be linked via Google.', true);
  }

  const isValid = verifyPassword(oldPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError(StatusCodes.UNAUTHORIZED, 'Incorrect old password', true);
  }

  const newHash = hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash }
  });

  return { message: 'Password changed successfully' };
};

export const deleteUserAccount = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(StatusCodes.NOT_FOUND, 'User not found', true);

  // Anonymize Feedbacks
  await prisma.feedback.updateMany({
    where: { userId },
    data: { userId: null }
  });

  // Anonymize OrderEnquiry where user is customer
  await prisma.orderEnquiry.updateMany({
    where: { customerId: userId },
    data: { customerId: null }
  });

  // Delete User (Prisma Cascade will delete Vendor, VendorMedia, CatalogItems, etc.)
  // OrderEnquiry where user is vendor will have vendorId set to null (SetNull in schema)
  await prisma.user.delete({
    where: { id: userId }
  });

  return { message: 'Account deleted successfully' };
};
