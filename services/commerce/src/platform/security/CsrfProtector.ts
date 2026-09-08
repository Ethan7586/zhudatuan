import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthReturnTargets, AuthTarget } from '@shop/config/server';
import { token } from '../../composition/Container';

interface CsrfClaims {
  readonly session: string;
  readonly target: AuthTarget;
  readonly origin: string;
  readonly expiresAt: number;
}

export class CsrfProtector {
  constructor(
    private readonly key: string,
    private readonly targets: AuthReturnTargets
  ) {
    if (Buffer.byteLength(key) < 32) throw new Error('CSRF_KEY_INVALID');
  }

  issue(sessionToken: string, target: AuthTarget, lifetimeSeconds: number): string {
    if (!sessionToken || !Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds < 1) throw new Error('CSRF_ISSUE_INPUT_INVALID');
    const claims: CsrfClaims = {
      session: sessionHash(sessionToken),
      target,
      origin: new URL(this.targets[target]).origin,
      expiresAt: Math.floor(Date.now() / 1_000) + lifetimeSeconds,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${payload}.${signature(this.key, payload)}`;
  }

  verify(token: string, sessionToken: string, target: AuthTarget, origin: string, now = Math.floor(Date.now() / 1_000)): boolean {
    const [payload, supplied, extra] = token.split('.');
    if (!payload || !supplied || extra !== undefined || !sessionToken) return false;
    const expected = signature(this.key, payload);
    const suppliedBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CsrfClaims>;
      return (
        parsed.session === sessionHash(sessionToken) && parsed.target === target && parsed.origin === origin && parsed.origin === new URL(this.targets[target]).origin && Number.isSafeInteger(parsed.expiresAt) && parsed.expiresAt! >= now
      );
    } catch {
      return false;
    }
  }
}

export const CSRF_PROTECTOR = token<CsrfProtector>('security.csrf');

function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function signature(key: string, payload: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}
