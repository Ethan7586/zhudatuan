import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

import type { AccountingPort } from './AccountingPort';
import type { SettlementReadPort } from './SettlementReadPort';
export type { AccountCommand, AccountKind, AccountingPort, HoldCommand, PostingAccount, PostingCommand, PostingSource } from './AccountingPort';
export type { SettlementCursor, SettlementEntry, SettlementReadPort } from './SettlementReadPort';
export interface CheckoutInvoicePort {
  snapshot(context: ReadTransactionContext, profile: string | null, owner: string): Promise<unknown | null>;
  current(context: ReadTransactionContext, owner: string): Promise<Readonly<{ enabled: boolean; profileId: string | null; title: string | null; taxpayerNumberMasked: string | null; version: number }>>;
}
export const CHECKOUT_INVOICE_PORT = publicPort<CheckoutInvoicePort>('finance', 'checkout');
export interface OrderImportFinancePort {
  verifyStatementEvidence(context: ReadTransactionContext, reference: string, scope: string, amountMinor: number, currency: string): Promise<boolean>;
}
export const ORDER_IMPORT_FINANCE_PORT = publicPort<OrderImportFinancePort>('finance', 'orderimport');
export type BenefitAccountingPort = Pick<AccountingPort, 'ensureAccount' | 'post'>;
export type VoucherAccountingPort = Pick<AccountingPort, 'post'>;
export interface ChannelReconciliationPort {
  receiveReconciliation(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; provider: string; partner: string; period: string; statement: string; hash: string; run: string }>): Promise<void>;
}
export const PROVIDER_FINANCE_PORT = publicPort<ChannelReconciliationPort>('finance', 'providersync');
export const BENEFIT_ACCOUNTING_PORT = publicPort<BenefitAccountingPort>('finance', 'benefit');
export const BENEFIT_SETTLEMENT_READ_PORT = publicPort<SettlementReadPort>('finance', 'benefitsettlement');
export const VOUCHER_ACCOUNTING_PORT = publicPort<VoucherAccountingPort>('finance', 'voucher');
export { REFERRAL_FINANCE_PORT, type ReferralFinancePort } from './ReferralFinancePort';
