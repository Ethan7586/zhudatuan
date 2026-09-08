import { RUNTIME_LIMITS } from '@shop/config/runtime';

export interface HttpStreamFrame<T = unknown> {
  readonly id: string;
  readonly event: string;
  readonly data: T;
  readonly retry?: number;
}

export class HttpStream<T = unknown> {
  private readonly controller = new AbortController();
  private opened = false;
  private detach: (() => void) | undefined;
  private reason = 'completed';
  private readonly observers = new Set<(reason: string) => void>();

  constructor(
    private readonly source: AsyncIterable<HttpStreamFrame<T>> | ((signal: AbortSignal) => AsyncIterable<HttpStreamFrame<T>>),
    private readonly heartbeatMilliseconds = RUNTIME_LIMITS.stream.heartbeatMilliseconds
  ) {
    if (!Number.isSafeInteger(heartbeatMilliseconds) || heartbeatMilliseconds < 1_000) throw new Error('HTTP_STREAM_HEARTBEAT_INVALID');
  }

  readable(parent: AbortSignal): ReadableStream<Uint8Array> {
    if (this.opened) throw new Error('HTTP_STREAM_ALREADY_OPEN');
    this.opened = true;
    const abort = () => this.close('client');
    if (parent.aborted) abort();
    else {
      parent.addEventListener('abort', abort, { once: true });
      this.detach = () => parent.removeEventListener('abort', abort);
    }
    const events = typeof this.source === 'function' ? this.source(this.controller.signal) : this.source;
    const iterator = events[Symbol.asyncIterator]();
    const encoder = new TextEncoder();
    let pending: Promise<IteratorResult<HttpStreamFrame<T>>> | undefined;
    return new ReadableStream<Uint8Array>({
      pull: async (output) => {
        try {
          if (this.controller.signal.aborted) {
            output.close();
            return;
          }
          pending ??= iterator.next();
          const result = await nextOrHeartbeat(pending, this.heartbeatMilliseconds);
          if (result.kind === 'heartbeat') {
            output.enqueue(encoder.encode(': heartbeat\n\n'));
            return;
          }
          pending = undefined;
          if (result.value.done) {
            this.close('source');
            output.close();
            return;
          }
          output.enqueue(encoder.encode(frame(result.value.value)));
        } catch (cause) {
          this.close('error');
          await iterator.return?.();
          throw cause;
        }
      },
      cancel: async () => {
        this.close('client');
        await iterator.return?.();
      },
    });
  }

  close(reason = 'server'): void {
    if (this.controller.signal.aborted) return;
    this.reason = reason;
    this.detach?.();
    this.controller.abort(new Error(`HTTP_STREAM_CLOSED:${reason}`));
    for (const observer of this.observers) observer(reason);
    this.observers.clear();
  }

  get closeReason(): string {
    return this.reason;
  }
  onClose(observer: (reason: string) => void): void {
    this.observers.add(observer);
  }
}

export function isHttpStream(value: unknown): value is HttpStream {
  return value instanceof HttpStream;
}

function nextOrHeartbeat<T>(pending: Promise<IteratorResult<HttpStreamFrame<T>>>, milliseconds: number): Promise<{ readonly kind: 'heartbeat' } | { readonly kind: 'event'; readonly value: IteratorResult<HttpStreamFrame<T>> }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ kind: 'heartbeat' }), milliseconds);
    timer.unref?.();
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve({ kind: 'event', value });
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      }
    );
  });
}

function frame(value: HttpStreamFrame): string {
  if (!value.id || /[\r\n]/.test(value.id) || !value.event || /[\r\n]/.test(value.event)) throw new Error('HTTP_STREAM_FRAME_INVALID');
  const retry = value.retry === undefined ? '' : `retry: ${value.retry}\n`;
  const data = JSON.stringify(value.data)
    .split('\n')
    .map((line) => `data: ${line}\n`)
    .join('');
  return `id: ${value.id}\nevent: ${value.event}\n${retry}${data}\n`;
}
