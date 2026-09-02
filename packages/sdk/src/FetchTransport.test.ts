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

  it('opens a successful event stream without buffering it', async () => {
    const body = new ReadableStream<Uint8Array>();
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }));

    const response = await new FetchTransport(fetcher).open({ method: 'GET', url: 'https://api.example.test/events', headers: {} });

    expect(response.status).toBe(200);
    expect(response.stream).toBe(body);
    expect(response.body).toBeUndefined();
  });

  it('buffers only bounded JSON error responses during a stream handshake', async () => {
    const payload = JSON.stringify({ code: 'AUTHENTICATION_REQUIRED' });
    const response = await new FetchTransport(vi.fn().mockResolvedValue(new Response(payload, { status: 401, headers: { 'content-type': 'application/json' } }))).open({ method: 'GET', url: 'https://api.example.test/events', headers: {} });
    expect(response).toMatchObject({ status: 401, body: payload });
    expect(response.stream).toBeUndefined();
  });

  it('rejects a successful stream with the wrong media type or a missing body', async () => {
    await expect(new FetchTransport(vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))).open({ method: 'GET', url: 'https://api.example.test/events', headers: {} })).rejects.toThrow('SDK_STREAM_CONTENT_TYPE_INVALID');
    await expect(new FetchTransport(vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: { 'content-type': 'text/event-stream' } }))).open({ method: 'GET', url: 'https://api.example.test/events', headers: {} })).rejects.toThrow('SDK_STREAM_BODY_MISSING');
  });
});
