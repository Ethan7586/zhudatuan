export interface CartLine {
  readonly listing: string;
  readonly sku: string;
  readonly quantity: number;
  readonly version: number;
  readonly title: string;
}

export interface CartLineMutation {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly quantity: number;
  readonly version: number | null;
  readonly listingVersion: string;
  readonly unitMinor: number;
  readonly currency: string;
  readonly priceVersion: string;
}
