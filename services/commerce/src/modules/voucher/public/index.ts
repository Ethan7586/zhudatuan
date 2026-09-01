import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { VoucherChoice, VoucherRefund, VoucherTender } from './VoucherTender';
export type { VoucherChoice, VoucherRefund, VoucherTender } from './VoucherTender';
export interface CheckoutVoucherPort {
  preview(context: ReadTransactionContext, vouchers: readonly string[], member: string, scope: string): Promise<readonly VoucherChoice[]>;
  available(context: ReadTransactionContext, member: string, scope: string): Promise<readonly VoucherChoice[]>;
  reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly VoucherTender[]): Promise<void>;
}
export interface VerificationVoucherPort {
  redeemableScope(context: ReadTransactionContext, voucher: string, member: string): Promise<string | null>;
  redeemVerification(context: WriteTransactionContext, input: Readonly<{ voucher: string; verification: string; scope: string; actor: string }>): Promise<Readonly<{ id: string; amountMinor: number }> | null>;
}
export interface PaymentVoucherPort {
  consume(context: WriteTransactionContext, order: string, member: string, voucher: string, amountMinor: number): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
  refund(context: WriteTransactionContext, input: VoucherRefund): Promise<void>;
}
export const CHECKOUT_VOUCHER_PORT = publicPort<CheckoutVoucherPort>('voucher', 'checkout');
export const VERIFICATION_VOUCHER_PORT = publicPort<VerificationVoucherPort>('voucher', 'verification');
export const PAYMENT_VOUCHER_PORT = publicPort<PaymentVoucherPort>('voucher', 'payment');
