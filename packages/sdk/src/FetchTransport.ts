import type { Transport, TransportRequest, TransportResponse } from './Transport';

export class FetchTransport implements Transport {
  constructor(private readonly fetcher?: typeof fetch) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
    const response = await fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      credentials: 'include',
      redirect: 'error',
      ...(request.body === undefined ? {} : { body: request.body }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    return {
      status: response.status,
      headers: Object.freeze(Object.fromEntries(response.headers.entries())),
      body: await response.text(),
    };
  }
}
