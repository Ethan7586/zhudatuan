import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { trustedPeerAddress, writeResponse } from './NodeServer';

describe('trusted peer address', () => {
  it('accepts Caddy client identity only from the local reverse proxy', () => {
    expect(trustedPeerAddress('203.0.113.8', '127.0.0.1')).toBe('203.0.113.8');
    expect(trustedPeerAddress('2001:db8::8', '::1')).toBe('2001:db8::8');
    expect(trustedPeerAddress('203.0.113.9', '::ffff:127.0.0.1')).toBe('203.0.113.9');
    expect(trustedPeerAddress('203.0.113.8', '198.51.100.2')).toBe('198.51.100.2');
  });

  it('rejects malformed and ambiguous forwarded values', () => {
    expect(trustedPeerAddress('not-an-ip', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress('203.0.113.8, 198.51.100.2', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(['203.0.113.8', '203.0.113.9'], '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(undefined, undefined)).toBe('unknown');
  });
});

describe('writeResponse', () => {
  it('waits for drain before writing the next streaming chunk', async () => {
    const output = new FakeResponse(false);
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('first'));
          controller.enqueue(new TextEncoder().encode('second'));
          controller.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

    const pending = writeResponse(response, output as unknown as ServerResponse);
    await vi.waitFor(() => expect(output.chunks).toEqual(['first']));
    output.emit('drain');
    await pending;
    expect(output.chunks).toEqual(['first', 'second']);
    expect(output.end).toHaveBeenCalledOnce();
  });

  it('cancels the web stream when the socket closes under backpressure', async () => {
    let cancelled = false;
    const output = new FakeResponse(false);
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('event')); },
      cancel() { cancelled = true; },
    }));

    const pending = writeResponse(response, output as unknown as ServerResponse);
    await vi.waitFor(() => expect(output.chunks).toEqual(['event']));
    output.emit('close');
    await expect(pending).rejects.toThrow('REQUEST_ABORTED');
    expect(cancelled).toBe(true);
  });
});

class FakeResponse extends EventEmitter {
  statusCode = 0;
  readonly chunks: string[] = [];
  readonly headers = new Map<string, unknown>();
  readonly end = vi.fn();
  private first: boolean;

  constructor(first: boolean) {
    super();
    this.first = first;
  }

  setHeader(name: string, value: unknown) { this.headers.set(name, value); }
  write(value: Buffer): boolean {
    this.chunks.push(value.toString('utf8'));
    if (!this.first) {
      this.first = true;
      return false;
    }
    return true;
  }
}
