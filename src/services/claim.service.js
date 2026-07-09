import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import AppError from '../errors/AppError.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { generateCode, setOtp, verifyOtp } from '../utils/otpStore.js';
import { getVertical, getTier, TIERS } from '../config/verticals.js';

const isProd = env.NODE_ENV === 'production';

const normalizePhone = (p) => (p ? String(p).replace(/[^\d+]/g, '') : '');
const maskPhone = (p) => {
  const s = normalizePhone(p);
  return s.length >= 4 ? `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : s;
};

/**
 * Send an OTP over the WhatsApp Cloud API when credentials are configured. Returns
 * true if dispatched. When creds are absent we don't throw — the caller surfaces a
 * dev code instead (non-prod) so the claim flow is testable without WhatsApp.
 */
async function sendWhatsappOtp(phone, code) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return false;
  const to = normalizePhone(phone).replace(/^\+/, '');
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: `Your NearByBazar verification code is ${code}. It expires in 10 minutes.` },
      }),
    });
    if (!res.ok) {
      logger.error(`WhatsApp OTP send failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    logger.error(e, 'WhatsApp OTP send error');
    return false;
  }
}

const otpKey = (businessId, userId) => `claim:${businessId}:${userId}`;

/**
 * Start claiming an unclaimed (imported) stub. Sends an OTP to the listed phone, or
 * to a caller-supplied phone (owner-asserted) when the listing has none — OSM phone
 * coverage is low, so the asserted-phone fallback is the common path.
 */
export async function initiateClaim(businessId, user, assertedPhone) {
  const biz = await prisma.businessProfile.findUnique({ where: { id: businessId } });
  if (!biz || biz.deletedAt) throw new AppError(StatusCodes.NOT_FOUND, 'Listing not found', true);
  if (biz.isClaimed || biz.userId) throw new AppError(StatusCodes.CONFLICT, 'This listing has already been claimed', true);

  const listedPhone = biz.metaData?.osm?.contactPhone;
  const target = normalizePhone(assertedPhone) || normalizePhone(listedPhone) || normalizePhone(user.phoneNumber);
  if (!target) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'No phone number available to verify. Please provide one.', true);
  }

  const code = await setOtp(otpKey(businessId, user.id), generateCode(), target);
  const sent = await sendWhatsappOtp(target, code);

  return {
    businessId,
    sent,
    channel: sent ? 'whatsapp' : 'none',
    maskedPhone: maskPhone(target),
    usedListedPhone: !assertedPhone && !!listedPhone,
    // Non-prod convenience so the flow is testable without WhatsApp creds. NEVER in prod.
    ...(!isProd ? { devCode: code } : {}),
  };
}

/** Verify the OTP and assign ownership of the stub to the claiming user. */
export async function verifyClaim(businessId, user, code) {
  const biz = await prisma.businessProfile.findUnique({ where: { id: businessId } });
  if (!biz || biz.deletedAt) throw new AppError(StatusCodes.NOT_FOUND, 'Listing not found', true);
  if (biz.isClaimed || biz.userId) throw new AppError(StatusCodes.CONFLICT, 'This listing has already been claimed', true);

  const result = await verifyOtp(otpKey(businessId, user.id), code);
  if (!result.ok) {
    const msg = {
      no_code: 'No active code. Please request a new one.',
      expired: 'Your code has expired. Please request a new one.',
      too_many_attempts: 'Too many attempts. Please request a new code.',
      mismatch: 'Incorrect code. Please try again.',
    }[result.reason] || 'Verification failed.';
    throw new AppError(StatusCodes.BAD_REQUEST, msg, true);
  }

  const [claimed] = await prisma.$transaction([
    prisma.businessProfile.update({
      where: { id: businessId },
      data: { userId: user.id, isClaimed: true },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { role: 'vendor', hasVendorProfile: true },
    }),
  ]);
  return claimed;
}

/**
 * Upgrade (or set) a listing's tier — the "Activate your storefront / your own app"
 * path. Only the owner (or admin) may change it, and only to the vertical's default
 * tier or a tier it declares as upgradeable. moduleConfig is recomputed from the tier
 * so capabilities (storefront/booking/commerce) unlock accordingly.
 */
export async function upgradeTier(businessId, user, targetTier) {
  const tierKey = (targetTier || '').toUpperCase();
  if (!getTier(tierKey)) throw new AppError(StatusCodes.BAD_REQUEST, `Unknown tier "${targetTier}"`, true);

  const biz = await prisma.businessProfile.findUnique({ where: { id: businessId } });
  if (!biz || biz.deletedAt) throw new AppError(StatusCodes.NOT_FOUND, 'Listing not found', true);
  if (user.role !== 'admin' && biz.userId !== user.id) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You do not own this listing', true);
  }

  const vertical = getVertical(biz.businessType);
  const allowed = new Set([vertical?.defaultTier, ...(vertical?.upgradeableTo || [])].filter(Boolean));
  if (!allowed.has(tierKey)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `${biz.businessType} cannot be set to ${tierKey}. Allowed: ${[...allowed].join(', ')}`, true);
  }

  return prisma.businessProfile.update({
    where: { id: businessId },
    data: { listingTier: tierKey, moduleConfig: TIERS[tierKey].moduleConfig },
  });
}
