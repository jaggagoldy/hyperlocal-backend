import env from '../config/env.js';
import logger from '../config/logger.js';

/**
 * @typedef {Object} RFQWhatsAppPayload
 * @property {string} to - The vendor's phone number with country code (e.g., '919999999999')
 * @property {string} vendorName - The name of the vendor (maps to {{1}})
 * @property {string} serviceType - The requested service (maps to {{2}})
 */

class WhatsAppService {
  /**
   * Sends an automated WhatsApp template message to a vendor for a new RFQ.
   * @param {RFQWhatsAppPayload} payload 
   * @returns {Promise<{ success: boolean, messageId?: string, error?: any }>}
   */
  static async sendRFQNotification(payload) {
    const { to, vendorName, serviceType } = payload;

    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      logger.error('Missing WhatsApp environment variables (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID).');
      return { success: false, error: 'Configuration missing' };
    }

    const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const requestBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: {
        name: 'new_rfq_lead',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: vendorName },
              { type: 'text', text: serviceType }
            ]
          }
        ]
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error({ error: data.error }, 'Meta Cloud API Error');
        return { success: false, error: data.error };
      }

      logger.info({ messageId: data.messages?.[0]?.id, to }, 'WhatsApp RFQ Notification sent successfully');
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      logger.error({ err: error }, 'Unhandled Exception in sendRFQNotification');
      return { success: false, error: error.message };
    }
  }
}

export default WhatsAppService;
