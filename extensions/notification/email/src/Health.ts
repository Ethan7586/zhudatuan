import type { EmailClient } from './Client';

export class EmailHealth {
  constructor(private readonly client: EmailClient) {}
  check() {
    const open = this.client.circuitState() === 'open';
    return Promise.resolve(Object.freeze({ state: open ? ('degraded' as const) : ('healthy' as const), provider: this.client.provider, ...(open ? { reason: 'EMAIL_CIRCUIT_OPEN' } : {}) }));
  }
}
