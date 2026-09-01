import { describe, expect, it } from 'vitest';
import { StorefrontAddress } from './StorefrontAddress';

const config = Object.freeze({ origin: 'https://fufu.wang', entryPath: '/s' });

describe('StorefrontAddress', () => {
  it('constructs the one canonical public address', () => {
    expect(StorefrontAddress.from('zhudatuan-employee', config)).toEqual({
      handle: 'zhudatuan-employee',
      url: 'https://fufu.wang/s/zhudatuan-employee',
    });
  });

  it.each(['admin', 'Mall-One', ' mall-one', 'mall_one', 'ab', 'a'.repeat(49), 'mall%2fother', 'mall%5cother', '商城'])('rejects an unsafe handle: %s', (handle) => {
    expect(() => StorefrontAddress.from(handle, config)).toThrow('STOREFRONT_HANDLE_INVALID');
  });
});
