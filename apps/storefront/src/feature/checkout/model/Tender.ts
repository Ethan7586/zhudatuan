export interface Tender {
  readonly kind: 'benefit' | 'voucher' | 'wechat';
  readonly reference: string | null;
  readonly amountMinor: number;
}
