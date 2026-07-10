#!/usr/bin/env node
/**
 * Fire-test operational alerting (RG-001 item 7). Sends a real test alert to every
 * configured channel (ALERT_WEBHOOK_URL and/or ALERT_EMAIL) so you can confirm the
 * notification is actually received — a configured-but-never-fired alert does NOT
 * satisfy the Code Freeze criterion.
 *
 * Usage (set the channels first):
 *   ALERT_WEBHOOK_URL="https://hooks.slack.com/..." \
 *   ALERT_EMAIL="founder@example.com" RESEND_API_KEY="..." \
 *   node scripts/alert-test.js
 */
import { sendAlert } from '../src/services/alert.service.js';

const { delivered, channels } = await sendAlert(
  'Test alert (manual fire-test)',
  'This is a validation alert from scripts/alert-test.js. If you received this, the alerting delivery path works.',
  { source: 'alert-test', purpose: 'RG-001 item 7 fire-test' }
);

if (channels === 0) {
  console.error('No alert channel configured. Set ALERT_WEBHOOK_URL and/or ALERT_EMAIL and retry.');
  process.exit(1);
}
console.log(`Dispatched to ${delivered}/${channels} configured channel(s). Check that the notification arrived.`);
process.exit(delivered > 0 ? 0 : 1);
