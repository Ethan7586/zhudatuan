export interface AfterSaleReturn {
  readonly id: string;
  readonly state: 'authorized' | 'intransit' | 'received' | 'accepted' | 'rejected';
  readonly provider: string | null;
  readonly providerReference: string | null;
  readonly instruction: Readonly<Record<string, unknown>>;
  readonly trackingNumber: string | null;
}
