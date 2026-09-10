import { describe, expect, it } from 'vitest';
import { BrowserRequestHeaders, HttpHeader } from './HttpContract';
import { parseStorefrontEntryUrl, parseStorefrontHandle, storefrontEntryUrl } from './StorefrontEntry';

describe('StorefrontEntry', () => {
  it('creates the stable public entry from a canonical handle', () => {
    expect(storefrontEntryUrl('https://yengze.press', '/s', parseStorefrontHandle('zhudatuan-employee'))).toBe('https://yengze.press/s/zhudatuan-employee');
    expect(storefrontEntryUrl('http://127.0.0.1:3000', '/s', parseStorefrontHandle('zhudatuan-employee'))).toBe('http://127.0.0.1:3000/s/zhudatuan-employee');
    expect(BrowserRequestHeaders).toContain(HttpHeader.storefrontHandle);
  });

  it.each(['api', 'AUTH', ' mall-one', 'mall_one', 'ab', 'a'.repeat(49), 'mall%2fother', 'mall\\other', '商城'])('rejects an unsafe handle: %s', (handle) => {
    expect(() => parseStorefrontHandle(handle)).toThrow('STOREFRONT_HANDLE_INVALID');
  });

  it('rejects a second origin or entry prefix', () => {
    const handle = parseStorefrontHandle('mall-one');
    expect(() => storefrontEntryUrl('http://yengze.press', '/s', handle)).toThrow('STOREFRONT_ADDRESS_CONFIG_INVALID');
    expect(() => storefrontEntryUrl('https://yengze.press', '/store', handle)).toThrow('STOREFRONT_ADDRESS_CONFIG_INVALID');
  });

  it('validates an untrusted address against the one origin, prefix and handle', () => {
    const handle = parseStorefrontHandle('mall-one');
    expect(parseStorefrontEntryUrl('https://yengze.press/s/mall-one', 'https://yengze.press', '/s', handle)).toBe('https://yengze.press/s/mall-one');
    for (const value of ['http://yengze.press/s/mall-one', 'https://evil.example/s/mall-one', 'https://yengze.press/s/mall-two', 'https://yengze.press/s/mall-one?token=secret']) {
      expect(() => parseStorefrontEntryUrl(value, 'https://yengze.press', '/s', handle)).toThrow('STOREFRONT_ENTRY_URL_INVALID');
    }
  });
});
