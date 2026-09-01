import { describe, expect, it } from 'vitest';
import { BrowserRequestHeaders, HttpHeader } from './HttpContract';
import { parseStorefrontEntryUrl, parseStorefrontHandle, storefrontEntryUrl } from './StorefrontEntry';

describe('StorefrontEntry', () => {
  it('creates the stable public entry from a canonical handle', () => {
    expect(storefrontEntryUrl('https://fufu.wang', '/s', parseStorefrontHandle('zhudatuan-employee'))).toBe('https://fufu.wang/s/zhudatuan-employee');
    expect(storefrontEntryUrl('http://127.0.0.1:3000', '/s', parseStorefrontHandle('zhudatuan-employee'))).toBe('http://127.0.0.1:3000/s/zhudatuan-employee');
    expect(BrowserRequestHeaders).toContain(HttpHeader.storefrontHandle);
  });

  it.each(['api', 'AUTH', ' mall-one', 'mall_one', 'ab', 'a'.repeat(49), 'mall%2fother', 'mall\\other', '商城'])('rejects an unsafe handle: %s', (handle) => {
    expect(() => parseStorefrontHandle(handle)).toThrow('STOREFRONT_HANDLE_INVALID');
  });

  it('rejects a second origin or entry prefix', () => {
    const handle = parseStorefrontHandle('mall-one');
    expect(() => storefrontEntryUrl('http://fufu.wang', '/s', handle)).toThrow('STOREFRONT_ADDRESS_CONFIG_INVALID');
    expect(() => storefrontEntryUrl('https://fufu.wang', '/store', handle)).toThrow('STOREFRONT_ADDRESS_CONFIG_INVALID');
  });

  it('validates an untrusted address against the one origin, prefix and handle', () => {
    const handle = parseStorefrontHandle('mall-one');
    expect(parseStorefrontEntryUrl('https://fufu.wang/s/mall-one', 'https://fufu.wang', '/s', handle)).toBe('https://fufu.wang/s/mall-one');
    for (const value of ['http://fufu.wang/s/mall-one', 'https://evil.example/s/mall-one', 'https://fufu.wang/s/mall-two', 'https://fufu.wang/s/mall-one?token=secret']) {
      expect(() => parseStorefrontEntryUrl(value, 'https://fufu.wang', '/s', handle)).toThrow('STOREFRONT_ENTRY_URL_INVALID');
    }
  });
});
