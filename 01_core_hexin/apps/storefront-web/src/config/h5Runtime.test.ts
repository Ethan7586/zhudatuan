import { describe, expect, it } from 'vitest';
import { resolveH5RuntimeRequest } from './h5Runtime';

describe('H5 storefront runtime request', () => {
  it.each(['/', '/orders', '/anything/deep'])('serves %s through the dedicated H5 page', (pathname) => {
    const resolved = resolveH5RuntimeRequest(new Request(`https://h5.fufu.wang${pathname}?from=miniapp`));

    expect(resolved.url).toBe('https://h5.fufu.wang/h5?from=miniapp');
  });

  it.each(['/assets/app.js', '/_next/static/app.js', '/api/v1/catalog/listings'])('preserves runtime path %s', (pathname) => {
    const request = new Request(`https://h5.fufu.wang${pathname}`);

    expect(resolveH5RuntimeRequest(request)).toBe(request);
  });

  it('does not rewrite another hostname or a mutation request', () => {
    const webRequest = new Request('https://fufu.wang/orders');
    const mutationRequest = new Request('https://h5.fufu.wang/orders', { method: 'POST' });

    expect(resolveH5RuntimeRequest(webRequest)).toBe(webRequest);
    expect(resolveH5RuntimeRequest(mutationRequest)).toBe(mutationRequest);
  });
});
