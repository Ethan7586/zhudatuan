import { describe, expect, it, vi } from 'vitest';
import { returnDestination } from './ReturnDestination';

describe('returnDestination', () => {
  it('accepts only a verified proof for the same client target', () => {
    const destination = { url: 'https://yengze.press/s/mall-one/orders', proof: 'proof', expiresAt: '2026-09-01T00:01:00.000Z', target: 'storefront' as const };
    const returns = { verify: vi.fn(() => destination) };
    expect(returnDestination(returns as never, 'storefront', 'proof')).toBe(destination);
    expect(() => returnDestination(returns as never, 'console', 'proof')).toThrow('VALIDATION_FAILED');
    expect(() => returnDestination(returns as never, 'storefront', undefined)).toThrow('VALIDATION_FAILED');
  });

  it('converts signature failures to a non-leaking validation error', () => {
    const returns = {
      verify: vi.fn(() => {
        throw new Error('SECRET_SIGNING_DETAIL');
      }),
    };
    expect(() => returnDestination(returns as never, 'storefront', 'tampered')).toThrow('VALIDATION_FAILED');
  });
});
