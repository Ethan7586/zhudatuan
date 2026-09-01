export interface VoucherChoice {
  readonly id: string;
  readonly remainingMinor: number;
  readonly version: number;
  readonly program: string;
}

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
