/**
 * Minimal in-process OTP store with TTL — used by the Phase F "claim your listing"
 * flow (the platform's first OTP use). Single-instance friendly (Render runs one
 * web process); swap for Redis/a DB table if horizontally scaled. Codes expire and
 * are single-use, with a small attempt cap to blunt brute force.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const store = new Map(); // key -> { code, expiresAt, attempts }

export const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

/** Store (or replace) a code for `key`, returning the code. */
export const setOtp = (key, code) => {
  store.set(key, { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });
  return code;
};

/**
 * Verify a submitted code for `key`. Returns { ok, reason }. Consumes the code on
 * success; counts attempts and evicts after MAX_ATTEMPTS or expiry.
 */
export const verifyOtp = (key, submitted) => {
  const entry = store.get(key);
  if (!entry) return { ok: false, reason: 'no_code' };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { ok: false, reason: 'expired' };
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, reason: 'too_many_attempts' };
  }
  if (String(submitted) !== entry.code) return { ok: false, reason: 'mismatch' };
  store.delete(key);
  return { ok: true };
};

export const clearOtp = (key) => store.delete(key);
