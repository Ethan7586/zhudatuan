import { WechatApplicationCatalog } from '@shop/config/server';

import type { WechatPayConfigSource } from './Config';
import { WechatGateway } from './Gateway';

export class WechatPaymentFactory {
  static create(applications: unknown, configuration: unknown): WechatGateway {
    if (configuration === null || typeof configuration !== 'object' || Array.isArray(configuration)) throw new Error('WECHAT_PAYMENT_CONFIG_INVALID');
    return new WechatGateway(WechatApplicationCatalog.parse(applications), configuration as WechatPayConfigSource);
  }
}
