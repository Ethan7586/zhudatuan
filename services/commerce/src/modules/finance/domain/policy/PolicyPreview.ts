import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';
import type { FinancePolicy } from '../model/FinancePolicy';

export class PolicyPreview {
  constructor(private readonly key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('FINANCE_PREVIEW_KEY_INVALID');
  }

  create(policy: FinancePolicy, sample: Readonly<{ from: string; to: string; affectedCount: number }>, now: Date): Readonly<{ balanced: boolean; previewToken: string; previewHash: string; expiresAt: string }> {
    if (Number.isNaN(Date.parse(sample.from)) || Number.isNaN(Date.parse(sample.to)) || Date.parse(sample.from) >= Date.parse(sample.to) || !Number.isSafeInteger(sample.affectedCount) || sample.affectedCount < 0)
      throw new Error('FINANCE_POLICY_SAMPLE_INVALID');
    const debit = policy.entries.reduce((sum, entry) => sum + entry.debitMinor, 0);
    const credit = policy.entries.reduce((sum, entry) => sum + entry.creditMinor, 0);
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const previewHash = digest({ policy, sample });
    const claims = Buffer.from(JSON.stringify({ kind: 'policy', policy, sample, previewHash, expiresAt })).toString('base64url');
    const signature = createHmac('sha256', this.key).update(`financepreview:v1:${claims}`).digest('base64url');
    return Object.freeze({ balanced: debit === credit && debit > 0, previewToken: `${claims}.${signature}`, previewHash, expiresAt });
  }

  verify(token: string, expected: Readonly<{ policy: FinancePolicy; sample: Readonly<{ from: string; to: string; affectedCount: number }>; previewHash: string }>, now: Date): void {
    const [claims, signature, extra] = token.split('.');
    if (!claims || !signature || extra !== undefined) throw new DomainError('FINANCE_POLICY_INVALID');
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(createHmac('sha256', this.key).update(`financepreview:v1:${claims}`).digest('base64url'));
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new DomainError('FINANCE_POLICY_INVALID');
    let value: Readonly<Record<string, unknown>>;
    try {
      value = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as Readonly<Record<string, unknown>>;
    } catch {
      throw new DomainError('FINANCE_POLICY_INVALID');
    }
    if (value.kind !== 'policy' || value.previewHash !== expected.previewHash || typeof value.expiresAt !== 'string' || Date.parse(value.expiresAt) <= now.getTime()) throw new DomainError('FINANCE_POLICY_INVALID');
    if (expected.previewHash !== digest({ policy: expected.policy, sample: expected.sample }) || digest(value.policy) !== digest(expected.policy) || digest(value.sample) !== digest(expected.sample))
      throw new DomainError('FINANCE_POLICY_INVALID');
  }
}

export function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(',')}}`;
}
