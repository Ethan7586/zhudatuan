import { describe, expect, it, vi } from 'vitest';
import { HttpTransport } from './HttpTransport';

describe('HttpTransport', () => {
  it('sends external requests without browser credentials and accepts non-JSON metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('metadata-token', { status: 200, headers: { 'content-type': 'text/plain' } }));
    const response = await new HttpTransport(fetcher).send({ url: 'http://100.100.100.200/latest/api/token', method: 'PUT', headers: {} });
    expect(response.body).toBe('metadata-token');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', redirect: 'manual' });
  });
});
