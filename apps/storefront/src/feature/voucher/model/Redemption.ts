export interface Redemption {
  readonly id: string;
  readonly order: string | null;
  readonly amountMinor: number;
  readonly refundedMinor: number;
  readonly currency: string;
  readonly state: OperationOutputFor<'voucher.redemptions.get'>['state'];
  readonly redeemedAt: string;
}
import type { OperationOutputFor } from '@shop/contract';
