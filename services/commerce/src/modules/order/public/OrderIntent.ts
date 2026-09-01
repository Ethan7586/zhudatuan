import type { Money } from '@shop/kernel';

export interface OrderLineSnapshot {
  readonly sku: string;
  readonly listing: string;
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
  readonly versions: Readonly<Record<string, string | number>>;
  readonly accepted: boolean;
}

export interface CreateOrderIntent {
  readonly id: string;
  readonly scope: string;
  readonly member: string;
  readonly checkout: string;
  readonly money: Money;
  readonly evidence: unknown;
  readonly address: unknown;
  readonly invoice: unknown;
  readonly delivery: unknown;
  readonly experienceVersion: string | null;
  readonly lines: readonly OrderLineSnapshot[];
}
