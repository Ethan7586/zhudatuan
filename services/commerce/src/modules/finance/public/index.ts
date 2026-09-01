import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

import type { HoldIntent, PostingIntent } from './Accounting';
export type { HoldIntent, PostingIntent } from './Accounting';
export interface CheckoutInvoicePort {
  snapshot(context: ReadTransactionContext, profile: string | null, owner: string): Promise<unknown | null>;
  current(context: ReadTransactionContext, owner: string): Promise<Readonly<{ enabled: boolean; profileId: string | null; title: string | null; taxpayerNumberMasked: string | null; version: number }>>;
}
export const CHECKOUT_INVOICE_PORT = publicPort<CheckoutInvoicePort>('finance', 'checkout');
export interface BenefitAccountingPort {
  account(context: WriteTransactionContext, scope: string, code: string, currency: string, kind: 'asset' | 'liability' | 'income' | 'expense'): Promise<string>;
  post(context: WriteTransactionContext, intent: PostingIntent): Promise<string>;
  benefitLedger(context: ReadTransactionContext, accounts: readonly string[], after: Readonly<{ occurredAt: string | null; entry: string | null }>, limit: number): Promise<readonly BenefitLedgerEntry[]>;
}
export interface BenefitLedgerEntry {
  readonly id: string;
  readonly account: string;
  readonly amountMinor: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string;
  readonly occurredAt: Date | string;
}
export interface VoucherAccountingPort {
  post(context: WriteTransactionContext, intent: PostingIntent): Promise<string>;
}
export interface ChannelReconciliationPort {
  receiveReconciliation(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; provider: string; partner: string; period: string; statement: string; hash: string; run: string }>): Promise<void>;
}
export const PROVIDER_FINANCE_PORT = publicPort<ChannelReconciliationPort>('finance', 'providersync');
export const BENEFIT_ACCOUNTING_PORT = publicPort<BenefitAccountingPort>('finance', 'benefit');
export const VOUCHER_ACCOUNTING_PORT = publicPort<VoucherAccountingPort>('finance', 'voucher');
export { REFERRAL_FINANCE_PORT, type ReferralFinancePort } from './ReferralFinancePort';
