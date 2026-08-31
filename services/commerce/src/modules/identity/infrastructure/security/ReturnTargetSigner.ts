import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthReturnTargets, AuthTarget } from '@shop/config/server';
import type { ReturnTargetPort, SignedReturnTarget } from '../../application/port/ReturnTargetPort';

export type { SignedReturnTarget } from '../../application/port/ReturnTargetPort';

interface ReturnTargetPayload {
  readonly version: 2;
  readonly purpose: 'returntarget';
  readonly keyVersion: string;
  readonly target: AuthTarget;
  readonly url: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly tenant?: string;
}

export class ReturnTargetSigner implements ReturnTargetPort {
  constructor(
    private readonly targets: AuthReturnTargets,
    private readonly key: string,
    private readonly previous?: string
  ) {
    if (key.length < 32 || (previous !== undefined && previous.length < 32)) throw new Error('RETURN_TARGET_KEY_INVALID');
  }

  issue(target: AuthTarget, options: Date | Readonly<{ now?: Date; tenant?: string }> = new Date()): SignedReturnTarget {
    const now = options instanceof Date ? options : (options.now ?? new Date());
    const tenant = options instanceof Date ? undefined : options.tenant;
    if (tenant !== undefined && !/^[0-9a-f-]{36}$/.test(tenant)) throw new Error('RETURN_TARGET_TENANT_INVALID');
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    const url = this.targets[target];
    const value: ReturnTargetPayload = Object.freeze({ version: 2, purpose: 'returntarget', keyVersion: 'current', target, url, expiresAt, nonce: randomBytes(24).toString('base64url'), ...(tenant === undefined ? {} : { tenant }) });
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return Object.freeze({ url, proof: `${payload}.${this.sign(payload, this.key)}`, expiresAt, target, ...(tenant === undefined ? {} : { tenant }) });
  }

  verify(proof: string, now = new Date()): SignedReturnTarget {
    const [encoded, signature, extra] = proof.split('.');
    if (!encoded || !signature || extra !== undefined || encoded.length > 2048) invalid();
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return invalid();
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
    const payload = value as Partial<ReturnTargetPayload>;
    const keys = payload.tenant === undefined ? ['expiresAt', 'keyVersion', 'nonce', 'purpose', 'target', 'url', 'version'] : ['expiresAt', 'keyVersion', 'nonce', 'purpose', 'target', 'tenant', 'url', 'version'];
    if (
      Object.keys(payload).sort().join(',') !== keys.sort().join(',') ||
      payload.version !== 2 ||
      payload.purpose !== 'returntarget' ||
      (payload.keyVersion !== 'current' && payload.keyVersion !== 'previous') ||
      (payload.target !== 'console' && payload.target !== 'storefront') ||
      typeof payload.url !== 'string' ||
      payload.url !== this.targets[payload.target] ||
      typeof payload.expiresAt !== 'string' ||
      typeof payload.nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{32}$/.test(payload.nonce) ||
      (payload.tenant !== undefined && (typeof payload.tenant !== 'string' || !/^[0-9a-f-]{36}$/.test(payload.tenant)))
    )
      invalid();
    const expires = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expires) || expires <= now.getTime() || expires > now.getTime() + 60_000) invalid();
    const selected = payload.keyVersion === 'current' ? this.key : this.previous;
    if (!selected || !secureEqual(signature, this.sign(encoded, selected))) invalid();
    return Object.freeze({ url: payload.url, proof, expiresAt: payload.expiresAt, target: payload.target, ...(payload.tenant === undefined ? {} : { tenant: payload.tenant }) });
  }

  private sign(payload: string, key: string): string {
    return createHmac('sha256', key).update(payload).digest('base64url');
  }
}
function secureEqual(left: string, right: string): boolean {
  const supplied = Buffer.from(left);
  const expected = Buffer.from(right);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function invalid(): never {
  throw new Error('RETURN_TARGET_INVALID');
}
