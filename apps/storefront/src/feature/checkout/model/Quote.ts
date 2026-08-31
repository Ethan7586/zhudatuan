import type { Tender } from './Tender';

export interface QuoteLine {
  readonly listing: string;
  readonly quantity: number;
  readonly payableMinor: number;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly versions: Readonly<Record<string, string | number>>;
}

export interface Quote {
  readonly checkoutId: string;
  readonly quoteId: string;
  readonly quoteVersion: number;
  readonly signature: string;
  readonly expiresAt: string;
  readonly cartVersion: number;
  readonly lines: readonly QuoteLine[];
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly shippingMinor: number;
  readonly payableMinor: number;
  readonly benefitMinor: number;
  readonly personalMinor: number;
  readonly currency: string;
  readonly tenders: readonly Tender[];
  readonly rejections: readonly Readonly<{ listing: string; reasons: readonly string[] }>[];
}
