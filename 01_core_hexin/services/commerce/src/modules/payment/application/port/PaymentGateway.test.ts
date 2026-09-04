import { describe, expect, it } from 'vitest';
import { providerOccurredAt } from './PaymentGateway';

describe('providerOccurredAt', () => {
  it.each(['2026-08-31T23:59:59+08:00', '2026-08-31T15:59:59Z', '2026-08-31T23:59:59.123456789+08:00', '2028-02-29T00:00:00-05:30'])('retains a strict provider timestamp without changing its legal-period offset (%s)', (value) => {
    expect(providerOccurredAt(value)).toBe(value);
  });

  it.each([
    undefined,
    null,
    '',
    '2026-02-29T00:00:00+08:00',
    '2026-08-31 23:59:59+08:00',
    '2026-08-31T24:00:00+08:00',
    '2026-08-31T23:60:00+08:00',
    '2026-08-31T23:59:60+08:00',
    '2026-08-31T23:59:59+14:01',
    '2026-08-31T23:59:59+15:00',
    '2026-08-31T23:59:59+24:00',
    '1999-12-31T23:59:59Z',
  ])('rejects a missing, normalized or impossible provider timestamp (%s)', (value) => {
    expect(() => providerOccurredAt(value)).toThrow('PAYMENT_PROVIDER_OCCURRED_AT_INVALID');
  });
});
