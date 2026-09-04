import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface VoucherTender {
  readonly reference: string;
  readonly amountMinor: number;
}

export interface VoucherRefund {
  readonly refund: string;
  readonly order: string;
  readonly member: string;
  readonly voucher: string;
  readonly amountMinor: number;
}

export interface CheckoutVoucherTenderPort {
  reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly VoucherTender[]): Promise<void>;
}

export interface PaymentVoucherPort {
  consume(context: WriteTransactionContext, order: string, member: string, voucher: string, amountMinor: number): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
  refund(context: WriteTransactionContext, input: VoucherRefund): Promise<void>;
}

export interface FulfillmentVoucherItem {
  readonly line: string;
  readonly product: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface FulfillmentVoucherReceipt {
  readonly reference: string;
  readonly vouchers: readonly string[];
}

export interface FulfillmentVoucherPort {
  issue(
    context: WriteTransactionContext,
    input: Readonly<{
      fulfillment: string;
      order: string;
      scope: string;
      member: string;
      items: readonly FulfillmentVoucherItem[];
    }>
  ): Promise<FulfillmentVoucherReceipt>;
}
