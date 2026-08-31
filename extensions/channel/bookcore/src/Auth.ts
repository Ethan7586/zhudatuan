import { HmacAuthenticator, type IntegrationAuthenticator } from '@shop/providercore';

export function createWenxuanAuth(secret: Readonly<Record<string, string>>): IntegrationAuthenticator {
  return new HmacAuthenticator(required(secret, 'keyId', 'WENXUAN_KEYID_MISSING'), required(secret, 'secret', 'WENXUAN_SECRET_MISSING'));
}

function required(source: Readonly<Record<string, string>>, key: string, code: string): string {
  const value = source[key];
  if (!value?.trim()) throw new Error(code);
  return value;
}
