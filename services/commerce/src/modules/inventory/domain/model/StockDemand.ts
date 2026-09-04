export interface StockDemand {
  readonly sku: string;
  readonly listing: string;
  readonly stockitem: string | null;
  readonly quantity: number;
  readonly accepted: boolean;
}
