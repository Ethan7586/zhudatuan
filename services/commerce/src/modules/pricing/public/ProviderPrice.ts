export interface ProviderPrice {
  readonly id: string;
  readonly book: string;
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: unknown;
  readonly effectiveAt: string;
  readonly expiresAt: unknown;
}
