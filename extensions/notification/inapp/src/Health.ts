import type { InappClient } from './Client';

export class InappHealth {
  constructor(private readonly client: InappClient) {}

  check(): Promise<Readonly<{ state: 'healthy'; provider: 'inapp' }>> {
    void this.client;
    return Promise.resolve(Object.freeze({ state: 'healthy', provider: 'inapp' }));
  }
}
