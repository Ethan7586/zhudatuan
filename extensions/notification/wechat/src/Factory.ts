import type { SecretReader } from '@shop/contract';
import { WechatClient } from './Client';
import { parseWechatConfiguration } from './Config';

export class WechatFactory {
  static async create(configuration: unknown, secrets: SecretReader, fetcher: typeof fetch = fetch): Promise<WechatClient> {
    const parsed = parseWechatConfiguration(configuration);
    const secret = (await secrets.resolve(parsed.credentialRef)).reveal('notification');
    return new WechatClient(parsed, secret, fetcher);
  }
}
