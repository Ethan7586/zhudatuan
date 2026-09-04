import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface MarketingReservation {
  readonly campaign: string;
  readonly campaignVersion: number;
  readonly member: string;
  readonly order: string;
  readonly scope: string;
  readonly amountMinor: number;
  readonly expiresAt: string;
}
export interface MarketingRefund {
  readonly refund: string;
  readonly order: string;
  readonly refundedMinor: number;
  readonly capturedMinor: number;
}
export interface MarketingReservePort {
  reserve(context: WriteTransactionContext, input: MarketingReservation): Promise<void>;
  commit(context: WriteTransactionContext, order: string): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
  refund(context: WriteTransactionContext, input: MarketingRefund): Promise<void>;
}
