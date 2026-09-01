import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CatalogPosition, StorefrontListing } from '../../../catalog/public/CatalogReadPort';
import type { StorefrontAvailability } from '../../../inventory/public/InventoryReadPort';
import type { StorefrontPrice } from '../../../pricing/public/PricingReadPort';

export class CatalogMapper {
  constructor(private readonly key: string) {
    if (key.length < 32) throw new Error('STOREFRONT_CURSOR_KEY_INVALID');
  }

  encode(position: CatalogPosition | null): string | null {
    if (!position) return null;
    const payload = Buffer.from(JSON.stringify({ version: 1, sort: position.sort, id: position.id })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  decode(cursor: string | null): CatalogPosition | null {
    if (!cursor) return null;
    const [payload, signature, extra] = cursor.split('.');
    if (!payload || !signature || extra || !same(signature, this.sign(payload))) throw new Error('STOREFRONT_CURSOR_INVALID');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (decoded.version !== 1 || typeof decoded.sort !== 'string' || typeof decoded.id !== 'string') throw new Error('STOREFRONT_CURSOR_INVALID');
    return Object.freeze({ sort: decoded.sort, id: decoded.id });
  }

  items(listings: readonly StorefrontListing[], prices: readonly StorefrontPrice[], availability: readonly StorefrontAvailability[]): readonly Readonly<Record<string, unknown>>[] {
    const priceBySku = new Map(prices.map((item) => [item.sku, item]));
    const stockBySku = new Map(availability.map((item) => [item.sku, item]));
    return Object.freeze(
      listings.map((listing) => {
        const { categoryId, categoryCode, categoryName, brandId, supplierId, ...catalog } = listing;
        return Object.freeze({
          ...catalog,
          category: Object.freeze({ id: categoryId, code: categoryCode, name: categoryName }),
          brandId,
          supplierId,
          price: priceBySku.get(listing.sku) ?? null,
          availability: stockBySku.get(listing.sku) ?? null,
        });
      })
    );
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.key).update(payload).digest('base64url');
  }
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
