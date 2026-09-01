export interface PostingIntent {
  readonly scope: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly currency: string;
  readonly description: string;
  readonly debit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly credit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly amountMinor: number;
  readonly occurredAt?: string;
  readonly ownerEventId?: string;
  readonly economicLegId?: string;
}

export interface HoldIntent {
  readonly scope: string;
  readonly account: Readonly<{ code: string; currency: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly amountMinor: number;
  readonly expiresAt: string;
}
