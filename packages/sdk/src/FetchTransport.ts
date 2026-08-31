import type { Transport, TransportRequest, TransportResponse } from './Transport';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

export class FetchTransport implements Transport {
  constructor(private readonly fetcher?: typeof fetch) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
    const response = await fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: 'include',
      redirect: 'manual',
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const length = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(length) && length > RUNTIME_LIMITS.sql.maximumResponseBytes) throw new Error('SDK_RESPONSE_TOO_LARGE');
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > RUNTIME_LIMITS.sql.maximumResponseBytes) throw new Error('SDK_RESPONSE_TOO_LARGE');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (body.length > 0 && contentType !== 'application/json') throw new Error('SDK_RESPONSE_CONTENT_TYPE_INVALID');
    return {
      status: response.status,
      headers: Object.freeze(Object.fromEntries(response.headers.entries())),
      body,
    };
  }
}
