import type { ProductView } from '../../../shared/runtime/StorefrontPort';

export interface CartLine {
  readonly id: string;
  readonly listingId: string;
  readonly skuId: string;
  readonly lineVersion: number;
  readonly product: ProductView;
  readonly quantity: number;
  readonly selectedSpec: Readonly<Record<string, string>>;
  readonly selected: boolean;
}
