import type { Voucher } from './Voucher';

export interface Redemption {
  readonly id: string;
  readonly voucherId: string;
  readonly orderId: string | null;
  readonly amountMinor: number;
  readonly redeemedAt: string;
  readonly reversedMinor: number;
  readonly state: 'redeemed' | 'partially_reversed' | 'reversed';
}

export interface VoucherCenter {
  readonly vouchers: readonly Voucher[];
  readonly redemptions: readonly Redemption[];
}
