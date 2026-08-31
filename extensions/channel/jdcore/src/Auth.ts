import { RsaAuthenticator, type IntegrationAuthenticator } from '@shop/providercore';

export function createJdAuth(secret: Readonly<Record<string, string>>): IntegrationAuthenticator {
  return new RsaAuthenticator(required(secret, 'keyId', 'JD_KEYID_MISSING'), required(secret, 'privateKey', 'JD_PRIVATEKEY_MISSING'));
}

function required(source: Readonly<Record<string, string>>, key: string, code: string): string {
  const value = source[key];
  if (!value?.trim()) throw new Error(code);
  return value;
}
