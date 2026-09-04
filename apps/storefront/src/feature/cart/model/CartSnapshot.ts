export interface CartSnapshotLine {
  readonly listing: string;
  readonly sku: string;
  readonly quantity: number;
  readonly version: number;
}

export interface CartSnapshot {
  readonly version: number;
  readonly items: readonly CartSnapshotLine[];
}
