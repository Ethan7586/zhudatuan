import { describe, expect, it } from 'vitest';
import { resolveStorefrontApiOrigin } from './canonicalApiClient';

describe('storefront canonical API origin', () => {
  it('keeps the sovereign L1 API origin inside the hbbtzn browser', () => {
    expect(resolveStorefrontApiOrigin('https://api.fufuwang.com.cn', 'production', 'https://fufuwang.com.cn'))
      .toBe('https://api.fufuwang.com.cn');
  });

  it('keeps the canonical API origin outside the L1 storefront browser', () => {
    expect(resolveStorefrontApiOrigin('https://api.fufuwang.com.cn', 'production', undefined))
      .toBe('https://api.fufuwang.com.cn');
    expect(resolveStorefrontApiOrigin('https://api.fufuwang.com.cn', 'production', 'https://console.fufuwang.com.cn'))
      .toBe('https://api.fufuwang.com.cn');
  });
});
