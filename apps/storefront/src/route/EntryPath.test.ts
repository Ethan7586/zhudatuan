import { describe, expect, it } from 'vitest';
import { readEntryPath } from './EntryPath';

describe('storefront entry path', () => {
  it('extracts a canonical handle and keeps the nested page', () => {
    expect(readEntryPath('/s/mall-one/orders/one')).toEqual({ handle: 'mall-one', basePath: '/s/mall-one', path: '/orders/one' });
  });

  it.each(['/mall-one', '/s/Admin', '/s/api', '/s/mall-one//orders', '/s/%2fadmin'])('rejects invalid path %s', (path) => {
    expect(() => readEntryPath(path)).toThrow();
  });
});
