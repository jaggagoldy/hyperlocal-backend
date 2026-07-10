process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

// Controllable env so each test can toggle which channels are configured.
const mockEnv = { ALERT_WEBHOOK_URL: undefined, ALERT_EMAIL: undefined, FROM_EMAIL: 'x@y.z', RESEND_API_KEY: 'k' };
jest.unstable_mockModule('../../config/env.js', () => ({ default: mockEnv, ENABLED_VERTICALS: [] }));

jest.unstable_mockModule('../../config/logger.js', () => ({
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() },
}));

const mockSendAlertEmail = jest.fn();
jest.unstable_mockModule('../email.service.js', () => ({ default: { sendAlertEmail: mockSendAlertEmail } }));

const { sendAlert } = await import('../alert.service.js');

describe('sendAlert (operational alerting, RG-001 item 7)', () => {
  beforeEach(() => {
    mockEnv.ALERT_WEBHOOK_URL = undefined;
    mockEnv.ALERT_EMAIL = undefined;
    mockSendAlertEmail.mockReset();
    global.fetch = jest.fn();
  });

  test('no-op when no channel is configured', async () => {
    const res = await sendAlert('nothing configured');
    expect(res).toEqual({ delivered: 0, channels: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSendAlertEmail).not.toHaveBeenCalled();
  });

  test('fans out to BOTH webhook and email when both are configured', async () => {
    mockEnv.ALERT_WEBHOOK_URL = 'https://hooks.example/abc';
    mockEnv.ALERT_EMAIL = 'ops@example.com';
    global.fetch.mockResolvedValue({ ok: true, status: 200 });
    mockSendAlertEmail.mockResolvedValue({ success: true, id: 'e1' });

    const res = await sendAlert('DB down', 'SELECT 1 failed', { host: 'neon' });

    expect(res).toEqual({ delivered: 2, channels: 2 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // webhook payload carries BOTH slack `text` and discord `content` keys
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.text).toContain('DB down');
    expect(body.content).toContain('DB down');
    expect(mockSendAlertEmail).toHaveBeenCalledWith('ops@example.com', 'DB down', expect.stringContaining('DB down'));
  });

  test('counts only the channel that succeeded (webhook non-2xx)', async () => {
    mockEnv.ALERT_WEBHOOK_URL = 'https://hooks.example/abc';
    mockEnv.ALERT_EMAIL = 'ops@example.com';
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    mockSendAlertEmail.mockResolvedValue({ success: true, id: 'e1' });

    const res = await sendAlert('partial');
    expect(res).toEqual({ delivered: 1, channels: 2 });
  });

  test('never throws when a channel rejects; still resolves', async () => {
    mockEnv.ALERT_WEBHOOK_URL = 'https://hooks.example/abc';
    global.fetch.mockRejectedValue(new Error('ECONNRESET'));

    const res = await sendAlert('resilient');
    expect(res).toEqual({ delivered: 0, channels: 1 });
  });

  test('email-only when just ALERT_EMAIL is set', async () => {
    mockEnv.ALERT_EMAIL = 'ops@example.com';
    mockSendAlertEmail.mockResolvedValue({ success: true, id: 'e1' });

    const res = await sendAlert('email only');
    expect(res).toEqual({ delivered: 1, channels: 1 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
