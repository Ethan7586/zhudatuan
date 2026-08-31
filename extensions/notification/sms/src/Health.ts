import type { SmsClient } from './Client';

export class SmsHealth {
  constructor(private readonly client: SmsClient) {}

  check(): Promise<Readonly<{ state: 'healthy' | 'degraded'; provider: 'aliyun'; reason?: string }>> {
    const open = this.client.circuitState() === 'open';
    return Promise.resolve(Object.freeze({ state: open ? 'degraded' : 'healthy', provider: 'aliyun', ...(open ? { reason: 'CIRCUIT_OPEN' } : {}) }));
  }
}
