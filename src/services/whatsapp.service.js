import env from '../config/env.js';
import logger from '../config/logger.js';

/**
 * @typedef {Object} RFQWhatsAppPayload
 * @property {string} to - The vendor's phone number with country code (e.g., '919999999999')
 * @property {string} vendorName - The name of the vendor (maps to {{1}})
 * @property {string} serviceType - The requested service (maps to {{2}})
 */

const GRAPH_API_VERSION = 'v20.0';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs a message payload to the Meta Graph API with bounded retries.
 * Retries only on transient failures (network errors, 429, 5xx) — a 4xx
 * response (bad template/params/recipient) will never succeed on retry.
 */
async function postWithRetry(requestBody, context) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    logger.error(context, 'Missing WhatsApp environment variables (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID).');
    return { success: false, error: 'Configuration missing' };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        logger.info({ ...context, attempt, messageId: data.messages?.[0]?.id }, 'WhatsApp message sent successfully');
        return { success: true, messageId: data.messages?.[0]?.id };
      }

      lastError = data.error || { message: `HTTP ${response.status}` };

      const transient = response.status === 429 || response.status >= 500;
      if (!transient) {
        logger.error({ ...context, attempt, status: response.status, error: data.error }, 'Meta Cloud API rejected the request (non-retryable)');
        return { success: false, error: lastError };
      }

      logger.warn({ ...context, attempt, status: response.status, error: data.error }, 'Meta Cloud API transient error, will retry if attempts remain');
    } catch (error) {
      lastError = { message: error.message };
      logger.warn({ ...context, attempt, err: error.message }, 'WhatsApp send network error, will retry if attempts remain');
    }

    if (attempt < MAX_ATTEMPTS) {
      await wait(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  logger.error({ ...context, error: lastError }, 'WhatsApp send failed after all retry attempts');
  return { success: false, error: lastError };
}

class WhatsAppService {
  /**
   * Sends an automated WhatsApp template message to a vendor for a new RFQ/lead.
   * Requires the 'new_rfq_lead' template to be approved in Meta Business Manager.
   * @param {RFQWhatsAppPayload} payload
   * @returns {Promise<{ success: boolean, messageId?: string, error?: any }>}
   */
  static async sendRFQNotification(payload) {
    const { to, vendorName, serviceType } = payload;

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: 'new_rfq_lead',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: vendorName },
              { type: 'text', text: serviceType },
            ],
          },
        ],
      },
    };

    return postWithRetry(requestBody, { to, template: 'new_rfq_lead' });
  }

  /**
   * Sends an automated WhatsApp template message for an OTP.
   * Requires a template named 'password_reset_otp' to be approved in Meta Business Manager.
   * @param {{ to: string, otpCode: string }} payload
   * @returns {Promise<{ success: boolean, messageId?: string, error?: any }>}
   */
  static async sendOTPNotification(payload) {
    const { to, otpCode } = payload;

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: 'password_reset_otp',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otpCode }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: otpCode }],
          },
        ],
      },
    };

    return postWithRetry(requestBody, { to, template: 'password_reset_otp' });
  }
}

export default WhatsAppService;
