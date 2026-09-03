import type { Product } from '../../../entity/product';
import type { Cart } from '../model/Cart';

interface CartValue {
  readonly version: number;
  readonly items: readonly Readonly<{ listing: string; sku: string; quantity: number; version: number }>[];
}

export function mapCart(value: CartValue | undefined, products: readonly Product[], selection: ReadonlySet<string>): Cart {
  const lines = (value?.items ?? []).flatMap((line) => {
    const product = products.find((item) => item.id === line.listing && item.skuId === line.sku);
    return product
      ? [Object.freeze({ id: line.listing, listingId: line.listing, skuId: line.sku, lineVersion: Number(line.version), product, quantity: Number(line.quantity), selectedSpec: Object.freeze({}), selected: selection.has(line.listing) })]
      : [];
  });
  return Object.freeze({ version: Number(value?.version ?? 0), lines: Object.freeze(lines) });
}
