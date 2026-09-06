import { describe, expect, it } from 'vitest';
import { resolveStorefrontApiOrigin } from './canonicalApiClient';

describe('storefront canonical API origin', () => {
  it('uses the L1 storefront origin inside the hbbtzn browser', () => {
    expect(resolveStorefrontApiOrigin('https://api.hbbtzn.com', 'production', 'https://hbbtzn.com'))
      .toBe('https://hbbtzn.com');
  });

  it('keeps the canonical API origin outside the L1 storefront browser', () => {
    expect(resolveStorefrontApiOrigin('https://api.hbbtzn.com', 'production', undefined))
      .toBe('https://api.hbbtzn.com');
    expect(resolveStorefrontApiOrigin('https://api.hbbtzn.com', 'production', 'https://console.hbbtzn.com'))
      .toBe('https://api.hbbtzn.com');
  });
});
