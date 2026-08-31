import type { SecretReader } from '@shop/contract';
import { SmsClient } from './Client';
import { parseSmsConfiguration, parseSmsCredential } from './Config';

export class SmsFactory {
  static async create(configuration: unknown, secrets: SecretReader): Promise<SmsClient> {
    const parsed = parseSmsConfiguration(configuration);
    const credential = parsed.credentialRef === null ? null : parseSmsCredential((await secrets.resolve(parsed.credentialRef)).reveal('notification'));
    return new SmsClient(parsed, credential);
  }
}
