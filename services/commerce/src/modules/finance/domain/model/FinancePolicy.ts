import { DomainError } from '../../../../foundation/domain/DomainError';
import { AccountCode } from '../value/AccountCode';

export interface FinanceEntryTemplate {
  readonly account: string;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly currency: string;
  readonly memo: string;
}

export class FinancePolicy {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly status: 'draft' | 'active' | 'retired',
    readonly trigger: string,
    readonly entries: readonly FinanceEntryTemplate[],
    readonly effectiveAt: string,
    readonly expiresAt: string | null,
    readonly version: number
  ) {
    if (!id || !name || !trigger || entries.length === 0 || entries.length > 100 || !Number.isSafeInteger(version) || version < 1 || Number.isNaN(Date.parse(effectiveAt))) throw new DomainError('FINANCE_POLICY_INVALID');
    if (expiresAt !== null && (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.parse(effectiveAt))) throw new Error('FINANCE_POLICY_PERIOD_INVALID');
    for (const entry of entries) validateEntry(entry);
    Object.freeze(this.entries);
    Object.freeze(this);
  }
}

export function validateEntry(entry: FinanceEntryTemplate): void {
  AccountCode.of(entry.account, entry.debitMinor > 0 ? 'expense' : 'liability');
  if (
    !entry.account ||
    !entry.memo ||
    !Number.isSafeInteger(entry.debitMinor) ||
    entry.debitMinor < 0 ||
    !Number.isSafeInteger(entry.creditMinor) ||
    entry.creditMinor < 0 ||
    entry.currency !== 'CNY' ||
    (entry.debitMinor === 0) === (entry.creditMinor === 0)
  ) {
    throw new DomainError('FINANCE_POLICY_INVALID');
  }
}
