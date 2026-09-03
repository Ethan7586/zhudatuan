import type { OperationOutputFor } from '@shop/contract';

export interface Listing {
  readonly id: string;
  readonly sku_id: string;
  readonly product_id: string;
  readonly title: string;
  readonly status: string;
  readonly version: number;
  readonly code?: string | null | undefined;
  readonly pool_id?: string | null | undefined;
  readonly product_type?: string | null | undefined;
  readonly subtitle?: string | null | undefined;
  readonly cover_url?: string | null | undefined;
  readonly effective_at?: string | null | undefined;
  readonly expires_at?: string | null | undefined;
  readonly cursor_sort?: string | undefined;
}

export interface ListingPage {
  readonly items: readonly Listing[];
  readonly count: number;
  readonly nextCursor?: string | undefined;
}

export interface Pool {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly status: string;
  readonly version: number;
  readonly item_count: number;
}

export interface PoolPage {
  readonly items: readonly Pool[];
  readonly count: number;
  readonly nextCursor?: string | undefined;
}

type DeepReadonly<T> = T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[] : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;
export type ProductDetail = DeepReadonly<OperationOutputFor<'catalog.product.detail.read'>>;

export interface ProductReceipt {
  readonly id?: string;
  readonly count?: number;
  readonly version?: number;
}

export interface ProductDraft {
  readonly title: string;
  readonly category: string;
  readonly type: 'physical' | 'virtual' | 'service' | 'voucher';
}
