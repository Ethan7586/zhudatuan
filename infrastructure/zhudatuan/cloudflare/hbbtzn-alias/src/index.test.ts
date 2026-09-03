import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('hbbtzn H5 alias worker', () => {
  it('serves the WeChat authorization verification file byte-for-byte from the storefront root', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://hbbtzn.com/MP_verify_5ebC4TM1ep4hKgu3.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('5ebC4TM1ep4hKgu3');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces every storefront document route through the dedicated H5 page', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>H5</html>'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/desktop-1920?source=desktop'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/h5?source=desktop');
  });

  it('keeps assets intact and sends API paths to the canonical API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/assets/app.js'));
    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/assets/app.js');
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://api.zhudatuan.com/api/v1/catalog/listings');
  });

  it('keeps the public H5 origin while proxying its API to the canonical API upstream', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://api.zhudatuan.com/api/v1/catalog/listings');
    expect(upstreamRequest.headers.get('origin')).toBe('https://zhudatuan.com');
  });

  it('mounts consumer auth below the same H5 origin without exposing the control-plane hostname', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>accounts</html>'));
    vi.stubGlobal('fetch', fetchMock);

    const slashRedirect = await worker.fetch(new Request('https://hbbtzn.com/accounts'));
    await worker.fetch(new Request('https://hbbtzn.com/accounts/?target=storefront&surface=h5'));
    await worker.fetch(new Request('https://hbbtzn.com/accounts/assets/app.js'));

    expect(slashRedirect.status).toBe(308);
    expect(slashRedirect.headers.get('location')).toBe('https://hbbtzn.com/accounts/');
    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://accounts.zhudatuan.com/?target=storefront&surface=h5');
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://accounts.zhudatuan.com/assets/app.js');
  });

  it.each([
    ['https://accounts.hbbtzn.com/login?client=console', 'https://accounts.zhudatuan.com/login?client=console'],
    ['https://api.hbbtzn.com/api/v1/identity/sessions', 'https://api.zhudatuan.com/api/v1/identity/sessions'],
  ])('redirects control-plane alias %s to %s', async (source, destination) => {
    const response = await worker.fetch(new Request(source));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(destination);
  });

  it('moves the old mall hostname to the one H5 storefront hostname', async () => {
    const response = await worker.fetch(new Request('https://mall.hbbtzn.com/orders?from=qr'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://hbbtzn.com/orders?from=qr');
  });
});
