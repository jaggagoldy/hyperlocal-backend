process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Deliberately left unset in this file's process, and env.js parses process.env
// once at import time — so importing WhatsAppService here (a fresh module
// registry, isolated per test file) exercises the real missing-config guard.
delete process.env.WHATSAPP_ACCESS_TOKEN;
delete process.env.WHATSAPP_PHONE_NUMBER_ID;

import { jest } from '@jest/globals';

const { default: WhatsAppService } = await import('../whatsapp.service.js');

describe('Vendor notification journey: WhatsAppService with missing credentials', () => {
  test('fails fast with zero network calls when WhatsApp credentials are not configured', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    const result = await WhatsAppService.sendRFQNotification({ to: '919999999999', vendorName: 'Test Vendor', serviceType: 'Plumbing' });

    expect(result).toEqual({ success: false, error: 'Configuration missing' });
    expect(fetchSpy).not.toHaveBeenCalled();

    delete global.fetch;
  });
});
