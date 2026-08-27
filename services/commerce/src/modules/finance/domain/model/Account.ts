export type AccountKind = 'asset' | 'liability' | 'income' | 'expense';

export interface Account {
  readonly id: string;
  readonly scope: string;
  readonly code: string;
  readonly currency: 'CNY';
  readonly kind: AccountKind;
}
