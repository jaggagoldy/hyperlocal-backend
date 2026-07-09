process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

// In-memory fake of the OtpSession table, keyed by the unique hashedToken, so a
// setOtp → verifyOtp round-trip exercises the real hashing + branch logic.
const rows = new Map();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: {
    otpSession: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = where.hashedToken;
        rows.set(key, rows.has(key) ? { ...rows.get(key), ...update } : { ...create });
        return rows.get(key);
      }),
      findUnique: jest.fn(async ({ where }) => rows.get(where.hashedToken) || null),
      update: jest.fn(async ({ where, data }) => {
        const row = rows.get(where.hashedToken);
        if (!row) throw new Error('Record not found');
        rows.set(where.hashedToken, { ...row, ...data });
        return rows.get(where.hashedToken);
      }),
      delete: jest.fn(async ({ where }) => {
        if (!rows.has(where.hashedToken)) throw new Error('Record not found');
        const row = rows.get(where.hashedToken);
        rows.delete(where.hashedToken);
        return row;
      }),
    },
  },
}));

const { generateCode, setOtp, verifyOtp, clearOtp } = await import('../otpStore.js');

describe('otpStore (OtpSession-backed, P0.1)', () => {
  beforeEach(() => rows.clear());

  test('generateCode returns a 6-digit numeric string', () => {
    expect(generateCode()).toMatch(/^\d{6}$/);
  });

  test('stores the code hashed, never in plaintext', async () => {
    await setOtp('claim:b1:u1', '123456', '+919999999999');
    const row = rows.get('claim:b1:u1');
    expect(row.otpHash).not.toBe('123456');
    expect(row.otpHash).toHaveLength(64); // sha256 hex
    expect(row.phoneNumber).toBe('+919999999999');
  });

  test('happy path: set then verify succeeds and consumes the code', async () => {
    await setOtp('claim:b1:u1', '123456');
    expect(await verifyOtp('claim:b1:u1', '123456')).toEqual({ ok: true });
    // single-use: a second verify finds nothing
    expect(await verifyOtp('claim:b1:u1', '123456')).toEqual({ ok: false, reason: 'no_code' });
  });

  test('no_code when nothing was issued for the key', async () => {
    expect(await verifyOtp('claim:none:none', '000000')).toEqual({ ok: false, reason: 'no_code' });
  });

  test('mismatch keeps the session and increments attempts; correct code still works', async () => {
    await setOtp('k', '111111');
    expect(await verifyOtp('k', '222222')).toEqual({ ok: false, reason: 'mismatch' });
    expect(rows.get('k').attempts).toBe(1);
    expect(await verifyOtp('k', '111111')).toEqual({ ok: true });
  });

  test('too_many_attempts after the cap, then the session is evicted', async () => {
    await setOtp('k', '111111');
    for (let i = 0; i < 5; i++) {
      expect(await verifyOtp('k', '000000')).toEqual({ ok: false, reason: 'mismatch' });
    }
    expect(await verifyOtp('k', '111111')).toEqual({ ok: false, reason: 'too_many_attempts' });
    expect(rows.has('k')).toBe(false);
  });

  test('expired code is rejected and evicted', async () => {
    await setOtp('k', '111111');
    rows.get('k').expiresAt = new Date(Date.now() - 1000); // force expiry
    expect(await verifyOtp('k', '111111')).toEqual({ ok: false, reason: 'expired' });
    expect(rows.has('k')).toBe(false);
  });

  test('re-issuing a code for the same key replaces it and resets attempts', async () => {
    await setOtp('k', '111111');
    await verifyOtp('k', '000000'); // attempts -> 1
    await setOtp('k', '222222'); // replace
    expect(rows.get('k').attempts).toBe(0);
    expect(await verifyOtp('k', '111111')).toEqual({ ok: false, reason: 'mismatch' }); // old code dead
    await setOtp('k', '222222');
    expect(await verifyOtp('k', '222222')).toEqual({ ok: true });
  });

  test('clearOtp removes an active session and is safe when the key is absent', async () => {
    await setOtp('k', '111111');
    await clearOtp('k');
    expect(rows.has('k')).toBe(false);
    await expect(clearOtp('k')).resolves.toBeUndefined(); // no throw when missing
  });
});
