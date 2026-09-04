import type { Product } from '../../../entity/product';
import type { CartSnapshotLine } from './CartSnapshot';

export interface CartLine {
  readonly id: string;
  readonly listingId: string;
  readonly skuId: string;
  readonly lineVersion: number;
  readonly product: Product;
  readonly title: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly available: number | null;
  readonly benefitApplicable: boolean;
  readonly validity: CartSnapshotLine['validity'];
  readonly quantity: number;
  readonly selectedSpec: Readonly<Record<string, string>>;
  readonly selected: boolean;
}
