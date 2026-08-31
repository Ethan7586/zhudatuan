import type { CheckoutSelection } from './CheckoutSelection';

export interface QuoteLine {
  readonly listing: string;
  readonly sku: string;
  readonly product: string;
  readonly productType: string;
  readonly category: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly stockitem: string | null;
  readonly versions: Readonly<Record<string, string | number>>;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

export interface TenderChoice {
  readonly kind: 'benefit' | 'voucher' | 'wechat';
  readonly reference: string | null;
  readonly amountMinor: number;
}

export interface CheckoutQuote {
  readonly cart: Readonly<{ id: string; member: string; mall: string; application: string; version: number }>;
  readonly selection: CheckoutSelection;
  readonly lines: readonly QuoteLine[];
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly personalMinor: number;
  readonly currency: 'CNY';
  readonly tenders: readonly TenderChoice[];
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly rejections: readonly Readonly<{ listing: string; reasons: readonly string[] }>[];
}
