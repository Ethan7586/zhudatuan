import { createHmac, timingSafeEqual } from 'node:crypto';
import { Money } from '@shop/kernel';
import type { FinanceEntryTemplate } from '../model/FinancePolicy';
import { validateEntry } from '../model/FinancePolicy';
import type { RepairDifference } from '../model/RepairCase';
import type { RepairProposal } from '../model/RepairProposal';
import { digest } from './PolicyPreview';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { PostingPolicy } from './PostingPolicy';
import { AccountCode } from '../value/AccountCode';

export class RepairPolicy {
  private readonly posting = new PostingPolicy();
  constructor(private readonly key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('FINANCE_PREVIEW_KEY_INVALID');
  }

  preview(
    input: RepairProposal,
    now: Date
  ): Readonly<{ balanced: boolean; previewToken: string; previewHash: string; expiresAt: string }> {
    this.assertProposal(input);
    const previewHash = digest(input);
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const claims = Buffer.from(
      JSON.stringify({ kind: 'repair', proposal: input, previewHash, expiresAt })
    ).toString('base64url');
    return Object.freeze({ balanced: true, previewToken: `${claims}.${this.sign(claims)}`, previewHash, expiresAt });
  }

  verify(token: string, expected: Readonly<{ scopeId: string; previewHash: string; makerId: string }>, now: Date): RepairProposal {
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
      value.previewHash !== expected.previewHash ||
      !isRecord(value.proposal) ||
      typeof value.expiresAt !== 'string'
    )
      throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    const expiresAt = Date.parse(value.expiresAt);
    if (!Number.isFinite(expiresAt)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    if (expiresAt <= now.getTime()) throw new DomainError('FINANCE_REPAIR_CONFLICT');
    const proposal = proposalOf(value.proposal);
    this.assertProposal(proposal);
    if (proposal.scopeId !== expected.scopeId || proposal.makerId !== expected.makerId || digest(proposal) !== expected.previewHash) {
      throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
    }
    return proposal;
  }

  assertDecision(makerId: string, checkerId: string): void {
    if (!makerId || !checkerId || makerId === checkerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
  }

  assertReversible(status: string, sourceReversalJournalId: string | null, replacementJournalId: string | null, rollbackJournalId: string | null): void {
    if (status !== 'approved' || !sourceReversalJournalId || !replacementJournalId || rollbackJournalId !== null) throw new DomainError('FINANCE_REPAIR_CONFLICT');
  }

  private assertProposal(input: RepairProposal): void {
    if (
      !input.scopeId ||
      !input.statementId ||
      !input.sourceJournalId.startsWith('journal:') ||
      !input.makerId ||
      !input.reason.trim() ||
      input.reason.length > 1_000 ||
      input.entries.length === 0 ||
      input.entries.length > 2_000 ||
      input.differences.length === 0 ||
      input.differences.length > 2_000 ||
      !/^[a-f0-9]{64}$/.test(input.sourceHash) ||
      !/^[a-f0-9]{64}$/.test(input.sourceJournalHash) ||
      !Number.isSafeInteger(input.sourceVersion) ||
      input.sourceVersion < 1 ||
      !Number.isSafeInteger(input.sourceJournalDebitMinor) ||
      input.sourceJournalDebitMinor <= 0
    ) throw new DomainError('VALIDATION_FAILED', { field: 'repair' });
    const postings = input.entries.map((entry) => {
      validateEntry(entry);
      const debit = entry.debitMinor > 0;
      return {
        account: AccountCode.of(entry.account, debit ? 'expense' : 'liability'),
        side: debit ? ('debit' as const) : ('credit' as const),
        amount: Money.of(debit ? entry.debitMinor : entry.creditMinor, entry.currency as 'CNY'),
      };
    });
    for (const difference of input.differences) assertDifference(difference);
    this.posting.assertBalanced(postings);
  }

  private sign(claims: string): string {
    return createHmac('sha256', this.key).update(`financerepair:v1:${claims}`).digest('base64url');
  }
}

function proposalOf(value: Record<string, unknown>): RepairProposal {
  if (!Array.isArray(value.entries) || !Array.isArray(value.differences)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
  return Object.freeze({
    scopeId: stringClaim(value.scopeId),
    statementId: stringClaim(value.statementId),
    sourceHash: stringClaim(value.sourceHash),
    sourceVersion: numberClaim(value.sourceVersion),
    sourceJournalId: stringClaim(value.sourceJournalId),
    sourceJournalHash: stringClaim(value.sourceJournalHash),
    sourceJournalDebitMinor: numberClaim(value.sourceJournalDebitMinor),
    entries: Object.freeze(value.entries.map(entryOf)),
    differences: Object.freeze(value.differences.map(differenceOf)),
    makerId: stringClaim(value.makerId),
    reason: stringClaim(value.reason),
  });
}

function entryOf(value: unknown): FinanceEntryTemplate {
  if (!isRecord(value)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
  return Object.freeze({ account: stringClaim(value.account), debitMinor: numberClaim(value.debitMinor), creditMinor: numberClaim(value.creditMinor), currency: stringClaim(value.currency), memo: stringClaim(value.memo) });
}

function differenceOf(value: unknown): RepairDifference {
  if (!isRecord(value)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
  const difference = Object.freeze({ id: stringClaim(value.id), kind: stringClaim(value.kind), expectedMinor: numberClaim(value.expectedMinor), actualMinor: numberClaim(value.actualMinor), deltaMinor: numberClaim(value.deltaMinor), currency: stringClaim(value.currency) });
  assertDifference(difference);
  return difference;
}

function assertDifference(value: RepairDifference): void {
  if (!value.id || !value.kind || !Number.isSafeInteger(value.expectedMinor) || !Number.isSafeInteger(value.actualMinor) || value.deltaMinor !== value.actualMinor - value.expectedMinor || value.currency !== 'CNY') {
    throw new DomainError('VALIDATION_FAILED', { field: 'difference' });
  }
}

function stringClaim(value: unknown): string {
  if (typeof value !== 'string') throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
  return value;
}

function numberClaim(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
