import env from './env.js';

// Coarse "which database are we pointed at" flag, derived from DATABASE_URL.
// Only the host is ever surfaced (never credentials). Used for the boot log
// and a /meta endpoint so it's obvious when running against the local dev DB.
let host = 'unknown';
try {
  host = new URL(env.DATABASE_URL).host;
} catch {
  /* malformed url — leave as 'unknown' */
}

export const dbHost = host;
export const isLocalDb = /localhost|127\.0\.0\.1/.test(env.DATABASE_URL);
export const dbMode = isLocalDb ? 'local' : 'remote';
