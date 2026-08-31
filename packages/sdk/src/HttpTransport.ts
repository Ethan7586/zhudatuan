import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { Transport, TransportRequest, TransportResponse } from './Transport';

export class HttpTransport implements Transport {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const response = await this.fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: 'omit',
      redirect: 'manual',
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > RUNTIME_LIMITS.sql.maximumResponseBytes) throw new Error('SDK_RESPONSE_TOO_LARGE');
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > RUNTIME_LIMITS.sql.maximumResponseBytes) throw new Error('SDK_RESPONSE_TOO_LARGE');
    return Object.freeze({ status: response.status, headers: Object.freeze(Object.fromEntries(response.headers.entries())), body });
  }
}
