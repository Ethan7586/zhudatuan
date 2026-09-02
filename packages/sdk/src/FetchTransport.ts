import type { StreamTransportResponse, Transport, TransportRequest, TransportResponse } from './Transport';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

export class FetchTransport implements Transport {
  constructor(private readonly fetcher?: typeof fetch) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const response = await this.fetch(request);
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

  async open(request: TransportRequest): Promise<StreamTransportResponse> {
    const response = await this.fetch(request);
    const headers = Object.freeze(Object.fromEntries(response.headers.entries()));
    if (response.status < 200 || response.status >= 300) {
      const body = await readLimited(response, RUNTIME_LIMITS.stream.maximumEventBytes);
      return Object.freeze({ status: response.status, headers, body });
    }
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'text/event-stream') throw new Error('SDK_STREAM_CONTENT_TYPE_INVALID');
    if (response.body === null) throw new Error('SDK_STREAM_BODY_MISSING');
    return Object.freeze({ status: response.status, headers, stream: response.body });
  }

  private fetch(request: TransportRequest): Promise<Response> {
    const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
    return fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: 'include',
      redirect: 'manual',
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  }
}

async function readLimited(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > limit) throw new Error('SDK_STREAM_ERROR_TOO_LARGE');
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > limit) throw new Error('SDK_STREAM_ERROR_TOO_LARGE');
  return body;
}
