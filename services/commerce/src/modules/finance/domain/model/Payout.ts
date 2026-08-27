export type PayoutState = 'submitted' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'uncertain' | 'cancelled';

export interface Payout {
  readonly id: string;
  readonly settlement: string;
  readonly amountMinor: number;
  readonly currency: 'CNY';
  readonly destination: string;
  readonly state: PayoutState;
  readonly providerReference: string | null;
}
