import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

export interface VoucherChoice {
  readonly id: string;
  readonly remainingMinor: number;
  readonly version: number;
  readonly product: string;
}

export interface CheckoutVoucherPort {
  preview(context: ReadTransactionContext, vouchers: readonly string[], member: string, scope: string): Promise<readonly VoucherChoice[]>;
  available(context: ReadTransactionContext, member: string, scope: string): Promise<readonly VoucherChoice[]>;
}

export interface VerificationVoucherPort {
  redeemableScope(context: ReadTransactionContext, voucher: string, member: string): Promise<string | null>;
  redeemVerification(context: WriteTransactionContext, input: Readonly<{ voucher: string; verification: string; scope: string; store: string; actor: string }>): Promise<Readonly<{ id: string; amountMinor: number }> | null>;
}
