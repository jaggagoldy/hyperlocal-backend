import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // Comma-separated list of live verticals (business types). Others show as "Coming Soon".
  ENABLED_VERTICALS: z.string().default('FOOD_BEVERAGE'),
  // Default geographic scope for the launch region.
  DEFAULT_STATE: z.string().default('Haryana'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Using console.error here is acceptable before logger might be fully initialized, 
  // but since we want to use pino, let's just log and exit.
  // Wait, logger imports env.js. This is a circular dependency! 
  // We should NOT import logger here if logger imports env.js.
  console.error('❌ Invalid environment variables:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export default parsedEnv.data;

// Parsed, normalized list of live verticals (business types).
export const ENABLED_VERTICALS = parsedEnv.data.ENABLED_VERTICALS
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
