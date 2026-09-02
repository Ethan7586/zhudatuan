import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { Schema } from '@shop/contract';
import { ApiError } from './error';
import { errorCause } from './ErrorCause';
import type { StreamTransportResponse } from './Transport';

export interface EventStream<T> extends AsyncIterable<T> {
  close(): void;
}

export class EventStreamResyncError extends Error {
  readonly code = 'SUPPORT_EVENT_RESYNC_REQUIRED';

  constructor(readonly cursor: string | undefined, options?: ErrorOptions) {
    super('The event cursor is outside the retention window; reload authoritative support state.', options);
    this.name = 'EventStreamResyncError';
  }
}

export type EventConnector = (lastEventId: string | undefined, signal: AbortSignal) => Promise<StreamTransportResponse>;

interface EventFrame {
  readonly event?: string;
  readonly id?: string;
  readonly data?: string;
  readonly retry?: number;
}

export class JsonEventStream<T> implements EventStream<T> {
  private readonly lifetime = new AbortController();
  private consumed = false;
  private lastEventId: string | undefined;
  private retryMilliseconds: number = RUNTIME_LIMITS.stream.reconnectMinimumMilliseconds;

  constructor(
    private readonly connect: EventConnector,
    private readonly schema: Schema<T>,
    initialLastEventId?: string,
    signal?: AbortSignal
  ) {
    this.lastEventId = initialLastEventId;
    if (signal?.aborted) this.lifetime.abort(signal.reason);
    else signal?.addEventListener('abort', () => this.lifetime.abort(signal.reason), { once: true });
  }

  close(): void {
    if (!this.lifetime.signal.aborted) this.lifetime.abort(new Error('SDK_STREAM_CLOSED'));
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.consumed) throw new Error('SDK_STREAM_ALREADY_CONSUMED');
    this.consumed = true;
    return this.events()[Symbol.asyncIterator]();
  }

  private async *events(): AsyncGenerator<T> {
    let attempt = 0;
    while (!this.lifetime.signal.aborted) {
      try {
        const response = await this.open();
        if (response.status < 200 || response.status >= 300 || response.stream === undefined) {
          const error = ApiError.from(response.status, response.body ?? '', response.headers['x-request-id'] ?? 'stream');
          if (error.code === 'SUPPORT_EVENT_CURSOR_EXPIRED') throw new EventStreamResyncError(this.lastEventId, { cause: error });
          if (!error.retryable && response.status < 500) throw error;
          throw error;
        }
        attempt = 0;
        for await (const frame of parseEventFrames(response.stream, this.lifetime.signal)) {
          if (frame.id !== undefined) this.lastEventId = frame.id;
          if (frame.retry !== undefined) this.retryMilliseconds = clampRetry(frame.retry);
          if (frame.data === undefined) continue;
          let decoded: unknown;
          try {
            decoded = JSON.parse(frame.data);
          } catch (cause) {
            throw ApiError.contractResponse(response.headers['x-request-id'] ?? 'stream', cause);
          }
          try {
            yield this.schema.parse(decoded);
          } catch (cause) {
            throw ApiError.contractResponse(response.headers['x-request-id'] ?? 'stream', cause);
          }
        }
      } catch (cause) {
        if (this.lifetime.signal.aborted) return;
        if (cause instanceof EventStreamResyncError) throw cause;
        if (cause instanceof ApiError && !cause.retryable) throw cause;
        if (cause instanceof Error && ['SDK_STREAM_EVENT_TOO_LARGE', 'SDK_STREAM_CONTENT_TYPE_INVALID', 'SDK_STREAM_BODY_MISSING'].includes(cause.message)) throw cause;
        attempt += 1;
      }
      await delay(reconnectDelay(this.retryMilliseconds, attempt), this.lifetime.signal);
    }
  }

  private async open(): Promise<StreamTransportResponse> {
    const connection = new AbortController();
    const abort = () => connection.abort(this.lifetime.signal.reason);
    this.lifetime.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => connection.abort(new Error('SDK_STREAM_HANDSHAKE_TIMEOUT')), RUNTIME_LIMITS.http.totalDeadlineMilliseconds);
    try {
      const response = await this.connect(this.lastEventId, connection.signal);
      if (connection.signal.aborted) throw errorCause(connection.signal.reason, 'REQUEST_ABORTED');
      return response;
    } finally {
      clearTimeout(timeout);
      this.lifetime.signal.removeEventListener('abort', abort);
    }
  }
}

async function* parseEventFrames(stream: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<EventFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const abort = () => void reader.cancel(signal.reason).catch(() => undefined);
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary = frameBoundary(pending);
      while (boundary !== undefined) {
        const raw = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary.length);
        assertFrameSize(raw);
        yield parseFrame(raw);
        boundary = frameBoundary(pending);
      }
      assertFrameSize(pending);
      if (chunk.done) break;
    }
    if (pending.length > 0) yield parseFrame(pending);
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

function frameBoundary(value: string): Readonly<{ index: number; length: number }> | undefined {
  const match = /\r?\n\r?\n/.exec(value);
  return match?.index === undefined ? undefined : { index: match.index, length: match[0].length };
}

function parseFrame(raw: string): EventFrame {
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.length === 0 || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const rawValue = separator < 0 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'event') event = value;
    else if (field === 'id' && !value.includes('\0')) id = value;
    else if (field === 'data') data.push(value);
    else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value);
  }
  return Object.freeze({
    ...(event === undefined ? {} : { event }),
    ...(id === undefined ? {} : { id }),
    ...(data.length === 0 ? {} : { data: data.join('\n') }),
    ...(retry === undefined ? {} : { retry }),
  });
}

function assertFrameSize(value: string): void {
  if (new TextEncoder().encode(value).byteLength > RUNTIME_LIMITS.stream.maximumEventBytes) throw new Error('SDK_STREAM_EVENT_TOO_LARGE');
}

function clampRetry(value: number): number {
  return Math.min(RUNTIME_LIMITS.stream.reconnectMaximumMilliseconds, Math.max(RUNTIME_LIMITS.stream.reconnectMinimumMilliseconds, value));
}

function reconnectDelay(base: number, attempt: number): number {
  const ceiling = Math.min(RUNTIME_LIMITS.stream.reconnectMaximumMilliseconds, base * 2 ** Math.min(attempt - 1, 10));
  return Math.floor(ceiling / 2 + Math.random() * (ceiling / 2));
}

async function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve, reject) => {
    const complete = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(complete, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(errorCause(signal.reason, 'REQUEST_ABORTED'));
    };
    signal.addEventListener('abort', abort, { once: true });
  }).catch((cause: unknown) => {
    if (!signal.aborted) throw cause;
  });
}
