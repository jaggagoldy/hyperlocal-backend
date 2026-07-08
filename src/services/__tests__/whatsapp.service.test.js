process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';

import { jest } from '@jest/globals';

const { default: WhatsAppService } = await import('../whatsapp.service.js');

describe('Vendor notification journey: WhatsAppService (smoke)', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('sends successfully on the first attempt', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.1' }] }) };
    });

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result).toEqual({ success: true, messageId: 'wamid.1' });
    expect(calls).toBe(1);
  });

  test('retries once on a transient 500 and then succeeds', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 500, json: async () => ({ error: { message: 'server error' } }) };
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.2' }] }) };
    });

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });

  test('does not retry a non-retryable 400 (bad template/params)', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      return { ok: false, status: 400, json: async () => ({ error: { message: 'invalid template param' } }) };
    });

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result.success).toBe(false);
    expect(calls).toBe(1);
  });

  test('gives up after 3 attempts against a persistent 503', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      return { ok: false, status: 503, json: async () => ({ error: { message: 'unavailable' } }) };
    });

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result.success).toBe(false);
    expect(calls).toBe(3);
  });

  test('retries a thrown network error the same as a transient HTTP failure', async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('ECONNRESET');
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.5' }] }) };
    });

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result.success).toBe(true);
    expect(calls).toBe(3);
  });

});
