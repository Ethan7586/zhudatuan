import type { WechatClient } from './Client';

export class WechatHealth {
  constructor(private readonly client: WechatClient) {}
  check() {
    const open = this.client.circuitState() === 'open';
    return Promise.resolve(Object.freeze({ state: open ? ('degraded' as const) : ('healthy' as const), provider: 'wechat' as const, ...(open ? { reason: 'WECHAT_NOTIFICATION_CIRCUIT_OPEN' } : {}) }));
  }
}
