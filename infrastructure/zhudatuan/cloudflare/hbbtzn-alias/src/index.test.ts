import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('hbbtzn H5 alias worker', () => {
  it('forces every storefront document route through the dedicated H5 page', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>H5</html>'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/desktop-1920?source=desktop'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/h5?source=desktop');
  });

  it('keeps assets and API paths intact', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/assets/app.js'));
    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/assets/app.js');
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://zhudatuan.com/api/v1/catalog/listings');
  });

  it('maps root-storefront CORS through the canonical upstream origin', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (request) => {
      expect((request as Request).headers.get('origin')).toBe('https://zhudatuan.com');
      return new Response('{}', { headers: { 'access-control-allow-origin': 'https://zhudatuan.com' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/identity/session', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    expect(response.headers.get('access-control-allow-origin')).toBe('https://hbbtzn.com');
  });

  it('moves the old mall hostname to the one H5 storefront hostname', async () => {
    const response = await worker.fetch(new Request('https://mall.hbbtzn.com/orders?from=qr'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://hbbtzn.com/orders?from=qr');
  });
});
