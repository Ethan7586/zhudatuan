import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { number, strictObject } from 'zod/mini';
import { JsonEventStream } from './EventStream';
import type { StreamTransportResponse } from './Transport';

const schema = strictObject({ value: number() });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('JsonEventStream', () => {
  it('parses heartbeats, split frames and multiple frames from one chunk', async () => {
    const source = new JsonEventStream(
      async () => success(': heartbeat\n\nid: event:1\ndata: {"val', 'ue":1}\n\nid: event:2\nevent: support.message.sent\ndata: {"value":2}\n\n'),
      schema
    );
    const iterator = source[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({ done: false, value: { value: 1 } });
    await expect(iterator.next()).resolves.toEqual({ done: false, value: { value: 2 } });
    source.close();
  });

  it('reconnects with Last-Event-ID and does not emit the previous event twice', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const cursors: Array<string | undefined> = [];
    let connection = 0;
    const source = new JsonEventStream(async (cursor) => {
      cursors.push(cursor);
      connection += 1;
      return connection === 1 ? success('id: event:1\ndata: {"value":1}\n\n') : success('id: event:2\ndata: {"value":2}\n\n');
    }, schema);
    const iterator = source[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({ done: false, value: { value: 1 } });
    const second = iterator.next();
    await vi.advanceTimersByTimeAsync(RUNTIME_LIMITS.stream.reconnectMinimumMilliseconds);
    await expect(second).resolves.toEqual({ done: false, value: { value: 2 } });
    expect(cursors).toEqual([undefined, 'event:1']);
    source.close();
  });

  it.each([401, 403, 426])('surfaces a structured %s handshake rejection without reconnecting', async (status) => {
    const connect = vi.fn().mockResolvedValue(error(status, status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 403 ? 'AUTHORIZATION_DENIED' : 'CONTRACT_VERSION_UNSUPPORTED'));
    const iterator = new JsonEventStream(connect, schema)[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toMatchObject({ status });
    expect(connect).toHaveBeenCalledOnce();
  });

  it('turns an expired cursor into an explicit authoritative-resync signal', async () => {
    const iterator = new JsonEventStream(async () => error(410, 'SUPPORT_EVENT_CURSOR_EXPIRED'), schema, 'event:old')[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toEqual(expect.objectContaining({ code: 'SUPPORT_EVENT_RESYNC_REQUIRED', cursor: 'event:old' }));
  });

  it('fails closed on invalid JSON and oversized frames', async () => {
    const invalid = new JsonEventStream(async () => success('id: event:1\ndata: {\n\n'), schema)[Symbol.asyncIterator]();
    await expect(invalid.next()).rejects.toMatchObject({ code: 'CONTRACT_RESPONSE_INVALID' });

    const oversized = new JsonEventStream(async () => success(`data: ${'x'.repeat(RUNTIME_LIMITS.stream.maximumEventBytes + 1)}\n\n`), schema)[Symbol.asyncIterator]();
    await expect(oversized.next()).rejects.toThrow('SDK_STREAM_EVENT_TOO_LARGE');
  });

  it('cancels a pending reader immediately when the caller aborts', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ cancel: () => { cancelled = true; } });
    const source = new JsonEventStream(async () => ({ status: 200, headers: {}, stream }), schema, undefined, controller.signal);
    const next = source[Symbol.asyncIterator]().next();
    await Promise.resolve();
    await Promise.resolve();
    controller.abort(new Error('scope changed'));

    await expect(next).resolves.toEqual({ done: true, value: undefined });
    expect(cancelled).toBe(true);
  });
});

function success(...chunks: string[]): StreamTransportResponse {
  const encoder = new TextEncoder();
  return {
    status: 200,
    headers: { 'x-request-id': 'request:stream' },
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
  };
}

function error(status: number, code: string): StreamTransportResponse {
  return {
    status,
    headers: { 'x-request-id': 'request:stream' },
    body: JSON.stringify({ code, message: code, requestId: 'request:stream', retryable: status >= 500 }),
  };
}
