import type { Product } from '../../../entity/product';

export interface CartLine {
  readonly id: string;
  readonly listingId: string;
  readonly skuId: string;
  readonly lineVersion: number;
  readonly product: Product;
  readonly quantity: number;
  readonly selectedSpec: Readonly<Record<string, string>>;
  readonly selected: boolean;
}
