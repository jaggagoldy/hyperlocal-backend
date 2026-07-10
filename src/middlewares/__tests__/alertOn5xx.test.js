import { jest } from '@jest/globals';

// The middleware imports sendAlert; stub it so this test loads no real config chain
// and record5xx can be tested as pure logic.
jest.unstable_mockModule('../../services/alert.service.js', () => ({ sendAlert: jest.fn() }));

const { record5xx, _reset, _config } = await import('../alertOn5xx.js');
const { THRESHOLD, WINDOW_MS, COOLDOWN_MS } = _config;

describe('record5xx (sustained 5xx detection, RG-001 item 7)', () => {
  beforeEach(() => _reset());

  test('does not fire below the threshold', () => {
    const t = 1_000_000;
    for (let i = 0; i < THRESHOLD - 1; i++) {
      expect(record5xx(t + i).fire).toBe(false);
    }
  });

  test('fires exactly when the threshold is reached', () => {
    const t = 1_000_000;
    let last;
    for (let i = 0; i < THRESHOLD; i++) last = record5xx(t + i);
    expect(last.fire).toBe(true);
    expect(last.count).toBe(THRESHOLD);
  });

  test('evicts hits outside the rolling window', () => {
    const t = 1_000_000;
    for (let i = 0; i < THRESHOLD; i++) record5xx(t + i); // fires once
    const later = record5xx(t + WINDOW_MS + 1000); // long after the window
    expect(later.count).toBe(1);
    expect(later.fire).toBe(false);
  });

  test('respects the cooldown, then fires again after it passes', () => {
    const t = 1_000_000;
    for (let i = 0; i < THRESHOLD; i++) record5xx(t + i); // first fire

    // A fresh burst still inside the cooldown must NOT fire again
    let r;
    for (let i = 0; i < THRESHOLD; i++) r = record5xx(t + 1000 + i);
    expect(r.fire).toBe(false);

    // After the cooldown, a new burst fires again
    const t2 = t + COOLDOWN_MS + 1000;
    for (let i = 0; i < THRESHOLD; i++) r = record5xx(t2 + i);
    expect(r.fire).toBe(true);
  });
});
