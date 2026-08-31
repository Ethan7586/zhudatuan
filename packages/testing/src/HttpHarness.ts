import type { ErrorContract } from '@shop/contract';
import type { Transport, TransportRequest, TransportResponse } from '@shop/sdk';

export function contractErrorResponse(status: number, error: ErrorContract): TransportResponse {
  return {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': error.requestId,
    },
    body: JSON.stringify(error),
  };
}

export class HttpHarness implements Transport {
  private readonly captured: TransportRequest[] = [];

  constructor(private readonly respond: (request: TransportRequest) => Promise<TransportResponse>) {}

  get requests(): readonly TransportRequest[] {
    return this.captured;
  }

  async send(request: TransportRequest): Promise<TransportResponse> {
    throwIfAborted(request.signal);
    this.captured.push(Object.freeze({ ...request, headers: Object.freeze({ ...request.headers }) }));
    return withAbort(() => this.respond(request), request.signal);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

function withAbort<T>(start: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return start();
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    start().then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });
}
