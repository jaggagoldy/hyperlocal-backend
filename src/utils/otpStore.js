/**
 * Persistent OTP store backed by the `OtpSession` table (P0.1) — used by the
 * Phase F "claim your listing" flow (the platform's first OTP use).
 *
 * Previously an in-process `Map`, which assumed a single web instance: an OTP
 * issued before a deploy/restart, or issued on one instance and verified on
 * another, was lost — intermittent, unreproducible verification failures once
 * the process restarts or scales horizontally. Persisting to Postgres removes
 * that assumption: any instance can issue and any instance can verify.
 *
 * The verification semantics are unchanged from the Map version — codes expire
 * (10 min TTL), are single-use, and carry a small attempt cap to blunt brute
 * force. One improvement: the code is stored HASHED (sha256), never in plaintext.
 *
 * `key` is an opaque caller-chosen identifier (e.g. `claim:<businessId>:<userId>`)
 * and maps to the unique `OtpSession.hashedToken` column, so there is exactly one
 * live code per key — issuing a new code replaces the old one (matching the Map's
 * set-overwrites behavior).
 */
import crypto from 'crypto';
import prisma from '../config/prisma.js';

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

export const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Store (or replace) a code for `key`, returning the code. `phoneNumber` is the
 * destination the code was sent to (recorded for audit/debugging; may be empty).
 */
export const setOtp = async (key, code, phoneNumber = '') => {
  const otpHash = hashCode(code);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.otpSession.upsert({
    where: { hashedToken: key },
    create: { hashedToken: key, otpHash, phoneNumber: phoneNumber || '', attempts: 0, isVerified: false, expiresAt },
    update: { otpHash, phoneNumber: phoneNumber || '', attempts: 0, isVerified: false, expiresAt },
  });
  return code;
};

/**
 * Verify a submitted code for `key`. Returns { ok, reason }. Consumes the code on
 * success; counts attempts and evicts after MAX_ATTEMPTS or expiry — identical
 * semantics to the previous in-memory store.
 */
export const verifyOtp = async (key, submitted) => {
  const entry = await prisma.otpSession.findUnique({ where: { hashedToken: key } });
  if (!entry) return { ok: false, reason: 'no_code' };

  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.otpSession.delete({ where: { hashedToken: key } }).catch(() => {});
    return { ok: false, reason: 'expired' };
  }

  const attempts = entry.attempts + 1;
  if (attempts > MAX_ATTEMPTS) {
    await prisma.otpSession.delete({ where: { hashedToken: key } }).catch(() => {});
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (hashCode(submitted) !== entry.otpHash) {
    await prisma.otpSession.update({ where: { hashedToken: key }, data: { attempts } });
    return { ok: false, reason: 'mismatch' };
  }

  await prisma.otpSession.delete({ where: { hashedToken: key } });
  return { ok: true };
};

export const clearOtp = async (key) =>
  prisma.otpSession.delete({ where: { hashedToken: key } }).catch(() => {});
