export type CartValidityCode = 'valid' | 'unpublished' | 'unavailable' | 'outofscope' | 'unpriced' | 'outofstock' | 'variantchanged';

export interface CartLine {
  readonly listing: string;
  readonly sku: string;
  readonly quantity: number;
  readonly selected: boolean;
  readonly version: number;
}

export interface CartLineMutation extends Omit<CartLine, 'version'> {
  readonly version: number | null;
}

export interface CartOffer {
  readonly listing: string;
  readonly sku: string;
  readonly title: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly available: number | null;
  readonly benefitApplicable: boolean;
  readonly listingVersion: string | null;
  readonly priceVersion: string | null;
  readonly inventoryVersion: string | null;
  readonly code: Exclude<CartValidityCode, 'outofstock'>;
}

export interface CartLineView extends CartLine {
  readonly title: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly available: number | null;
  readonly benefitApplicable: boolean;
  readonly validity: Readonly<{ state: 'valid' | 'invalid'; code: CartValidityCode; message: string }>;
}

export interface CartChange {
  readonly listing: string;
  readonly quantity: number;
  readonly selected: boolean | null;
  readonly lineVersion: number | null;
}

export interface CartItemResult {
  readonly requestedListing: string;
  readonly listing: string;
  readonly outcome: 'succeeded' | 'failed' | 'skipped';
  readonly reason: string | null;
  readonly lineVersion: number | null;
}

export interface CartPlan {
  readonly mutations: readonly CartLineMutation[];
  readonly results: readonly CartItemResult[];
}

export interface CartMergePlan {
  readonly blocked: string | null;
  readonly mutations: readonly CartLineMutation[];
}
