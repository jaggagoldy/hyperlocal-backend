import { z } from 'zod';

export const authSchemas = {
  requestOtp: z.object({
    body: z.object({
      phoneNumber: z.string().min(10).max(15),
      name: z.string().optional(),
    }),
  }),
  verifyOtp: z.object({
    body: z.object({
      phoneNumber: z.string().min(10).max(15),
      otpCode: z.string().length(6),
    }),
  }),
};

export const vendorSchemas = {
  create: z.object({
    body: z.object({
      registrationNumber: z.string().min(1),
      businessName: z.string().min(1),
      localityName: z.string().min(1),
      cityId: z.string().uuid(),
    }).passthrough(),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: z.enum(['available', 'busy', 'closed', 'emergency', 'suspended']).optional(),
    }).passthrough(),
  }),
  delete: z.object({
    params: z.object({ id: z.string().uuid() }),
  }),
};

export const searchSchemas = {
  explore: z.object({
    params: z.object({
      citySlug: z.string(),
      categorySlug: z.string(),
    }),
    query: z.object({
      query: z.string().optional(),
      page: z.string().regex(/^\d+$/).optional(),
      limit: z.string().regex(/^\d+$/).optional(),
    }).passthrough(),
  }),
};

export const adminSchemas = {
  createCity: z.object({
    body: z.object({ name: z.string(), slug: z.string() }),
  }),
  createCategory: z.object({
    body: z.object({ name: z.string(), slug: z.string() }),
  }),
  moderateVendor: z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ status: z.enum(['available', 'busy', 'closed', 'emergency', 'suspended', 'rejected']) }),
  }),
  overrideSubscription: z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      tier: z.enum(['Free', 'Starter', 'Pro']),
      durationDays: z.number().int().optional(),
    }),
  }),
};

export const mediaSchemas = {
  upload: z.object({
    body: z.object({
      vendorId: z.string().uuid(),
      type: z.enum(['profile_image', 'gallery', 'verification_doc']),
    }).passthrough(),
  }),
  delete: z.object({
    body: z.object({
      mediaId: z.string().uuid(),
      vendorId: z.string().uuid(),
    }),
  }),
};

export const analyticsSchemas = {
  interaction: z.object({
    body: z.object({
      vendorId: z.string().uuid(),
      type: z.enum(['profile_view', 'call_click', 'whatsapp_click']),
      metadata: z.any().optional(),
    }),
  }),
};
