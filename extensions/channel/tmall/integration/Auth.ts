import { HmacAuthenticator, type IntegrationAuthInput, type IntegrationAuthenticator } from '@shop/providercore';

export function createTmallAuth(secret: Readonly<Record<string, string>>): IntegrationAuthenticator {
  return new TmallAuthenticator(
    new HmacAuthenticator(required(secret, 'keyId', 'TMALL_KEYID_MISSING'), required(secret, 'secret', 'TMALL_SECRET_MISSING')),
    required(secret, 'authorizationExpiresAt', 'TMALL_AUTHORIZATION_EXPIRY_MISSING')
  );
}

export class TmallAuthenticator implements IntegrationAuthenticator {
  private readonly expiresAt: number;

  constructor(
    private readonly signer: IntegrationAuthenticator,
    expiresAt: string,
    private readonly clock: () => number = Date.now
  ) {
    this.expiresAt = Date.parse(expiresAt);
    if (!Number.isFinite(this.expiresAt)) throw new Error('TMALL_AUTHORIZATION_EXPIRY_INVALID');
  }

  async authenticate(input: IntegrationAuthInput): Promise<Readonly<Record<string, string>>> {
    const now = this.clock();
    const signedAt = Date.parse(input.timestamp);
    if (this.expiresAt <= now) throw new Error('TMALL_AUTHORIZATION_EXPIRED');
    if (!Number.isFinite(signedAt) || Math.abs(signedAt - now) > 300_000) throw new Error('TMALL_SIGNATURE_CLOCK_SKEW');
    return this.signer.authenticate(input);
  }
}

function required(source: Readonly<Record<string, string>>, key: string, code: string): string {
  const value = source[key];
  if (!value?.trim()) throw new Error(code);
  return value;
}
