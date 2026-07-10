/**
 * Operational alerting (RG-001 item 7) — the "someone is notified when production
 * is failing" layer that observability (logs) alone does not provide.
 *
 * Delivers an alert to the configured channels — a Slack/Discord incoming webhook
 * (ALERT_WEBHOOK_URL) and/or an email (ALERT_EMAIL, via the existing Resend
 * integration). Best-effort and NON-THROWING by design: the thing that watches for
 * failures must never itself crash the app. When nothing is configured it is a
 * no-op (debug log only) — the same optional-integration pattern as WhatsApp/
 * Cloudinary/Resend, so the app boots and runs fine without alerting wired.
 *
 * The full-outage / process-down case is intentionally NOT handled here — an
 * in-process alert cannot fire once the process is dead. That is covered by an
 * external uptime monitor polling /health (see docs/engineering/MONITORING.md).
 * This module covers the two app-owned signals: unhandled exceptions and a
 * sustained 5xx error rate.
 */
import env from '../config/env.js';
import logger from '../config/logger.js';
import EmailService from './email.service.js';

async function postWebhook(url, body) {
  try {
    // Slack reads `text`; Discord reads `content`. Sending both keys lets a single
    // configured webhook work regardless of which platform it points at — each
    // ignores the key it doesn't recognize.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body, content: body }),
    });
    if (!res.ok) {
      logger.error({ status: res.status }, 'Alert webhook returned non-2xx');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, 'Alert webhook request failed');
    return false;
  }
}

/**
 * Fan an operational alert out to every configured channel.
 * @param {string} title  short headline (also the email subject / webhook lead)
 * @param {string} [detail] longer body (stack trace, counts, etc.)
 * @param {object} [context] structured extras appended to the message
 * @returns {Promise<{ delivered: number, channels: number }>}
 */
export async function sendAlert(title, detail = '', context = {}) {
  const WEBHOOK_URL = env.ALERT_WEBHOOK_URL;
  const ALERT_EMAIL = env.ALERT_EMAIL;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const lead = `🚨 NearByBazar alert: ${title}`;
  const body = [
    lead,
    detail ? `\n${detail}` : '',
    `\nenv: ${nodeEnv}`,
    `\ntime: ${new Date().toISOString()}`,
    context && Object.keys(context).length ? `\ncontext: ${JSON.stringify(context)}` : '',
  ].join('');

  const tasks = [];
  if (WEBHOOK_URL) tasks.push(postWebhook(WEBHOOK_URL, body));
  if (ALERT_EMAIL) tasks.push(EmailService.sendAlertEmail(ALERT_EMAIL, title, body).then((r) => r?.success === true));

  if (!tasks.length) {
    logger.debug({ title }, 'sendAlert: no channel configured (ALERT_WEBHOOK_URL / ALERT_EMAIL unset) — skipping');
    return { delivered: 0, channels: 0 };
  }

  const results = await Promise.allSettled(tasks);
  const delivered = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  results.forEach((r) => {
    if (r.status === 'rejected') logger.error({ err: r.reason, title }, 'Alert channel threw');
  });
  logger.warn({ title, delivered, channels: tasks.length }, 'Operational alert dispatched');
  return { delivered, channels: tasks.length };
}
