import { Resend } from 'resend';
import env from '../config/env.js';
import logger from '../config/logger.js';

const resend = new Resend(env.RESEND_API_KEY);

/**
 * @typedef {Object} EmailResponse
 * @property {boolean} success
 * @property {string|null} id
 */

class EmailService {
  /**
   * Send a welcome email to a new user.
   * @param {string} to - The recipient's email address.
   * @param {string} name - The recipient's name.
   * @returns {Promise<EmailResponse>}
   */
  static async sendWelcomeEmail(to, name) {
    if (!env.RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY is not set. Skipping sendWelcomeEmail.');
      return { success: false, id: null };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `HyperLocal Go <${env.FROM_EMAIL}>`,
        to: [to],
        subject: 'Welcome to HyperLocal Marketplace!',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Welcome, ${name}!</h2>
            <p>We are thrilled to have you join the HyperLocal Marketplace.</p>
            <p>Our platform features a unified dual-profile architecture, meaning you can seamlessly switch between acting as a consumer to find services, and offering your own services as a provider!</p>
            <p>Explore your dashboard to get started today.</p>
            <br />
            <p>Best regards,<br/>The HyperLocal Team</p>
          </div>
        `,
      });

      if (error) {
        logger.error({ err: error }, 'Failed to send welcome email via Resend');
        return { success: false, id: null };
      }

      logger.info({ emailId: data?.id, to }, 'Welcome email sent successfully');
      return { success: true, id: data?.id || null };
    } catch (err) {
      logger.error({ err }, 'Exception occurred while sending welcome email');
      return { success: false, id: null };
    }
  }

  /**
   * Send a vendor activation email.
   * @param {string} to - The recipient's email address.
   * @param {string} vendorName - The vendor's business name.
   * @param {string} dashboardUrl - The URL to the vendor dashboard.
   * @returns {Promise<EmailResponse>}
   */
  static async sendVendorActivationEmail(to, vendorName, dashboardUrl) {
    if (!env.RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY is not set. Skipping sendVendorActivationEmail.');
      return { success: false, id: null };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `HyperLocal Pro <${env.FROM_EMAIL}>`,
        to: [to],
        subject: 'Your Pro Profile is Live!',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Congratulations, ${vendorName}!</h2>
            <p>Your business profile has been approved and is now live on the HyperLocal Marketplace.</p>
            <p>You are now eligible to receive local Request for Quotes (RFQs) directly from customers in your area.</p>
            <p>
              <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #4F46E5; text-decoration: none; border-radius: 5px;">
                Go to Dashboard
              </a>
            </p>
            <br />
            <p>Best regards,<br/>The HyperLocal Team</p>
          </div>
        `,
      });

      if (error) {
        logger.error({ err: error }, 'Failed to send vendor activation email via Resend');
        return { success: false, id: null };
      }

      logger.info({ emailId: data?.id, to }, 'Vendor activation email sent successfully');
      return { success: true, id: data?.id || null };
    } catch (err) {
      logger.error({ err }, 'Exception occurred while sending vendor activation email');
      return { success: false, id: null };
    }
  }
}

export default EmailService;
