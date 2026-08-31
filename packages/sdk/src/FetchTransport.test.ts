import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchTransport } from './FetchTransport';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('FetchTransport', () => {
  it('binds the native fetch receiver for strict browser implementations', async () => {
    const fetcher = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    globalThis.fetch = fetcher;

    const response = await new FetchTransport().send({
      method: 'GET',
      url: 'https://api.example.test/session',
      headers: {},
    });

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('passes the exact cancellation signal into native fetch', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    });

    await new FetchTransport(fetcher).send({
      method: 'GET',
      url: 'https://api.example.test/catalog',
      headers: {},
      signal: controller.signal,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
