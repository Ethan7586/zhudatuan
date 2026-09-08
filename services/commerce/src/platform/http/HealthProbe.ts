import { HttpClient } from './HttpClient';

export class HealthProbe {
  private readonly http: HttpClient;
  constructor(
    private readonly baseUrl: string,
    private readonly release: string,
    fetcher: typeof fetch = fetch
  ) {
    this.http = new HttpClient(fetcher);
  }

  async verify(probe: 'live' | 'startup' | 'ready'): Promise<void> {
    const response = await this.http.send(
      `${this.baseUrl}/health/${probe}`,
      {
        headers: { accept: 'application/json', 'x-release-verification': this.release },
        redirect: 'error',
      },
      { mode: 'read' }
    );
    if (!response.ok) throw new Error(`SMOKE_PROBE_FAILED:${probe}:${response.status}`);
    const body = (await response.json()) as { readonly status?: unknown };
    if (typeof body.status !== 'string' || !['live', 'started', 'ready'].includes(body.status)) throw new Error(`SMOKE_PROBE_INVALID:${probe}`);
  }
}
