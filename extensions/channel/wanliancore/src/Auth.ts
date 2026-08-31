import { RsaAuthenticator, type IntegrationAuthenticator } from '@shop/providercore';

export function createWanlianAuth(secret: Readonly<Record<string, string>>): IntegrationAuthenticator {
  return new RsaAuthenticator(required(secret, 'keyId', 'WANLIAN_KEYID_MISSING'), required(secret, 'privateKey', 'WANLIAN_PRIVATEKEY_MISSING'));
}

function required(source: Readonly<Record<string, string>>, key: string, code: string): string {
  const value = source[key];
  if (!value?.trim()) throw new Error(code);
  return value;
}
