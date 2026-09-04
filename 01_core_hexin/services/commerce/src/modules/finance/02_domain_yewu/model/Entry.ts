export interface Entry {
  readonly id: string;
  readonly journal: string;
  readonly account: string;
  readonly side: 'debit' | 'credit';
  readonly amountMinor: number;
}
