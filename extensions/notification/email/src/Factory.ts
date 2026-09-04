import type { SecretReader } from '@shop/contract';
import { EmailClient } from './Client';
import { parseEmailConfiguration } from './Config';

export class EmailFactory {
  static async create(configuration: unknown, secrets: SecretReader, fetcher: typeof fetch = fetch): Promise<EmailClient> {
    const parsed = parseEmailConfiguration(configuration);
    const credential = (await secrets.resolve(parsed.credentialRef)).reveal('notification');
    return new EmailClient(parsed, credential, fetcher);
  }
}
