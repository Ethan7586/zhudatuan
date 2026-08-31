import type { BenefitAccount, BenefitLot } from '../model/BenefitAccount';
import type { BenefitCenter, BenefitEntry } from '../model/BenefitEntry';
import { nullableText } from '../../../shared/format/Text';

type RecordValue = Readonly<Record<string, unknown>>;
export function mapBenefitCenter(accounts: readonly RecordValue[], ledger: readonly RecordValue[]): BenefitCenter {
  return Object.freeze({ accounts: Object.freeze(accounts.map(mapAccount)), ledger: Object.freeze(ledger.map(mapEntry)) });
}
function mapAccount(value: RecordValue): BenefitAccount {
  return Object.freeze({
    id: String(value.id),
    kind: value.kind as BenefitAccount['kind'],
    currency: String(value.currency),
    status: value.status as BenefitAccount['status'],
    balanceMinor: Number(value.balance_minor),
    frozenMinor: Number(value.frozen_minor),
    availableMinor: Number(value.available_minor),
    lots: Object.freeze((value.lots as readonly RecordValue[]).map(mapLot)),
  });
}
function mapLot(value: RecordValue): BenefitLot {
  return Object.freeze({
    id: String(value.id),
    batch: String(value.batch),
    totalMinor: Number(value.totalMinor),
    remainingMinor: Number(value.remainingMinor),
    state: String(value.state),
    effectiveAt: String(value.effectiveAt),
    expiresAt: nullableText(value.expiresAt),
  });
}
function mapEntry(value: RecordValue): BenefitEntry {
  return Object.freeze({
    id: String(value.id),
    account: String(value.account),
    kind: String(value.kind),
    currency: String(value.currency),
    amountMinor: Number(value.amountMinor),
    referenceType: String(value.referenceType),
    referenceId: String(value.referenceId),
    description: String(value.description),
    occurredAt: String(value.occurredAt),
  });
}
