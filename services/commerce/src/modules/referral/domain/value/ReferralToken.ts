import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';

interface TokenClaims {
  readonly scopeId: string;
  readonly promoterId: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly settingVersion: number;
}

export class ReferralToken {
  constructor(private readonly key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('REFERRAL_TOKEN_KEY_INVALID');
  }

  issue(claims: TokenClaims): string {
    validateClaims(claims);
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string, expectedScope: string, now: Date): Readonly<TokenClaims> {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) throw new DomainError('REFERRAL_INVALID_TOKEN');
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new DomainError('REFERRAL_INVALID_TOKEN');
    let claims: TokenClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
    } catch {
      throw new DomainError('REFERRAL_INVALID_TOKEN');
    }
    validateClaims(claims);
    if (claims.scopeId !== expectedScope || Date.parse(claims.expiresAt) <= now.getTime()) throw new DomainError('REFERRAL_INVALID_TOKEN');
    return Object.freeze({ ...claims });
  }

  fingerprint(token: string): string {
    return createHmac('sha256', this.key).update(`fingerprint:${token}`).digest('hex');
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.key).update(`referral:v1:${payload}`).digest('base64url');
  }
}

function validateClaims(claims: TokenClaims): void {
  if (!claims.scopeId || !claims.promoterId || !claims.nonce || !Number.isSafeInteger(claims.settingVersion) || claims.settingVersion < 1 || Number.isNaN(Date.parse(claims.expiresAt))) throw new DomainError('REFERRAL_INVALID_TOKEN');
}
