import type { ProductKind } from '../../../entity/product';

export interface OrderLine {
  readonly id: string;
  readonly productId: string;
  readonly listingId: string;
  readonly skuId: string;
  readonly title: string;
  readonly image: string;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly quantity: number;
  readonly categoryId: string;
  readonly itemType: ProductKind;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly partnerName: string | null;
}
