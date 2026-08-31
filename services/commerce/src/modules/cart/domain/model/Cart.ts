import type { CartLine } from './CartLine';

export interface Cart {
  readonly id: string;
  readonly mall: string;
  readonly application: string;
  readonly version: number;
  readonly updatedAt: Date | string;
  readonly lines: readonly CartLine[];
}

export interface EmptyCart {
  readonly version: 0;
  readonly lines: readonly [];
}

export interface CartView {
  readonly id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly version: number;
  readonly updated_at: Date | string;
  readonly items: readonly Readonly<{ listing: string; sku: string; quantity: number; version: number; title: string }>[];
}
