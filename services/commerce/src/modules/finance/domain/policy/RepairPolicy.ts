import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FinanceEntryTemplate } from '../model/FinancePolicy';
import type { RepairDifference } from '../model/RepairCase';
import { digest } from './PolicyPreview';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class RepairPolicy {
  constructor(private readonly key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('FINANCE_PREVIEW_KEY_INVALID');
  }

  preview(
    input: Readonly<{ scopeId: string; statementId: string; sourceHash: string; sourceVersion: number; entries: readonly FinanceEntryTemplate[]; differences: readonly RepairDifference[]; makerId: string; reason: string }>,
    now: Date
  ): Readonly<{ balanced: boolean; previewToken: string; previewHash: string; expiresAt: string }> {
    const debit = input.entries.reduce((sum, entry) => sum + entry.debitMinor, 0);
    const credit = input.entries.reduce((sum, entry) => sum + entry.creditMinor, 0);
    const previewHash = digest(input);
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const claims = Buffer.from(
      JSON.stringify({ kind: 'repair', scopeId: input.scopeId, statementId: input.statementId, sourceHash: input.sourceHash, sourceVersion: input.sourceVersion, previewHash, makerId: input.makerId, expiresAt })
    ).toString('base64url');
    return Object.freeze({ balanced: debit === credit && debit > 0, previewToken: `${claims}.${this.sign(claims)}`, previewHash, expiresAt });
  }

  verify(token: string, expected: Readonly<{ scopeId: string; previewHash: string; makerId: string }>, now: Date): Readonly<{ statementId: string; sourceHash: string; sourceVersion: number }> {
    const [claims, signature, extra] = token.split('.');
    if (!claims || !signature || extra !== undefined) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    const actual = Buffer.from(signature);
    const wanted = Buffer.from(this.sign(claims));
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    }
    if (
      value.kind !== 'repair' ||
      value.scopeId !== expected.scopeId ||
      value.previewHash !== expected.previewHash ||
      value.makerId !== expected.makerId ||
      typeof value.statementId !== 'string' ||
      typeof value.sourceHash !== 'string' ||
      !Number.isSafeInteger(value.sourceVersion) ||
      typeof value.expiresAt !== 'string'
    )
      throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    if (Date.parse(value.expiresAt) <= now.getTime()) throw new DomainError('FINANCE_REPAIR_CONFLICT');
    return Object.freeze({ statementId: value.statementId, sourceHash: value.sourceHash, sourceVersion: value.sourceVersion as number });
  }

  assertDecision(makerId: string, checkerId: string): void {
    if (!makerId || !checkerId || makerId === checkerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
  }

  private sign(claims: string): string {
    return createHmac('sha256', this.key).update(`financerepair:v1:${claims}`).digest('base64url');
  }
}
