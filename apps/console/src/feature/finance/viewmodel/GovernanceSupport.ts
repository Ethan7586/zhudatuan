import type { OperationId } from '@shop/contract';
import type { Receipt } from '@shop/presentation';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { FinanceEntryDraft } from '../model/FinanceGovernance';

export function operationAllowed(context: ConsoleContext, operation: OperationId): boolean {
  return canUseOperation(context, operation) && context.session.assurance.level >= requiredAssurance(operation);
}

export function governanceKey(context: ConsoleContext, operation: OperationId, cursor?: string) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'finance', 'governance', operation, cursor ?? null] as const);
}

export function governanceReceipt(requestId: string, reference: string, message: string): Receipt {
  return Object.freeze({ requestId, reference, occurredAt: new Date().toISOString(), message });
}

export function appendEntry(entries: readonly FinanceEntryDraft[]) {
  return Object.freeze([...entries, Object.freeze({ account: '', debitMinor: 0, creditMinor: 0, currency: 'CNY' as const, memo: '' })]);
}

export function removeEntry(entries: readonly FinanceEntryDraft[], index: number) {
  return Object.freeze(entries.filter((_, candidate) => candidate !== index));
}

export function replaceEntry<TKey extends keyof FinanceEntryDraft>(entries: readonly FinanceEntryDraft[], index: number, key: TKey, value: FinanceEntryDraft[TKey]) {
  return Object.freeze(entries.map((entry, candidate) => candidate === index ? Object.freeze({ ...entry, [key]: value }) : entry));
}

export function proofValid(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
