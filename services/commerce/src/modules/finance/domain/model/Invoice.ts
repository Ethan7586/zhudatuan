export type InvoiceKind = 'original' | 'red';
export type InvoiceState = 'submitted' | 'approved' | 'issuing' | 'issued' | 'rejected' | 'cancelled' | 'failed' | 'red';

export interface Invoice {
  readonly id: string;
  readonly settlement: string;
  readonly amountMinor: number;
  readonly currency: 'CNY';
  readonly kind: InvoiceKind;
  readonly redOf: string | null;
  readonly state: InvoiceState;
  readonly version: number;
}
