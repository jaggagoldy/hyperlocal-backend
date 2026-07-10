/**
 * Sustained-5xx alerting (RG-001 item 7). Attaches a response-finish hook that
 * counts server errors (status >= 500) in a rolling window and fires ONE alert
 * when the rate is sustained — not on every single 5xx (that would be noise), and
 * not more than once per cooldown (so an ongoing incident doesn't spam the channel).
 *
 * The counting logic lives in `record5xx(now)` so it can be unit-tested
 * deterministically by driving `now` — the middleware is a thin wrapper.
 */
import { sendAlert } from '../services/alert.service.js';

const WINDOW_MS = 5 * 60 * 1000; // look back 5 minutes
const THRESHOLD = Number(process.env.ALERT_5XX_THRESHOLD) || 5;
const COOLDOWN_MS = 15 * 60 * 1000; // at most one alert per 15 minutes

let hits = [];
let lastAlertAt = 0;

/** Test-only: reset the rolling window + cooldown. */
export const _reset = () => {
  hits = [];
  lastAlertAt = 0;
};

export const _config = { WINDOW_MS, THRESHOLD, COOLDOWN_MS };

/**
 * Record a 5xx at time `now`; evict entries outside the window; decide whether an
 * alert should fire (threshold reached AND past cooldown). Returns { fire, count }.
 */
export const record5xx = (now = Date.now()) => {
  hits.push(now);
  hits = hits.filter((t) => now - t < WINDOW_MS);
  if (hits.length >= THRESHOLD && now - lastAlertAt > COOLDOWN_MS) {
    lastAlertAt = now;
    return { fire: true, count: hits.length };
  }
  return { fire: false, count: hits.length };
};

export const alertOn5xx = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 500) return;
    const { fire, count } = record5xx();
    if (fire) {
      sendAlert(
        'Sustained 5xx error rate',
        `${count} server errors in the last ${WINDOW_MS / 60000} min (threshold ${THRESHOLD}).`,
        { lastPath: req.originalUrl, lastStatus: res.statusCode }
      ).catch(() => {});
    }
  });
  next();
};
