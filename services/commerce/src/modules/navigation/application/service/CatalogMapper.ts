import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CatalogPosition, StorefrontListing } from '../../../catalog/public/CatalogReadPort';
import type { StorefrontAvailability } from '../../../inventory/public/InventoryReadPort';
import type { StorefrontPrice } from '../../../pricing/public/PricingReadPort';
import type { CatalogQualificationDecision } from '../../../qualification/public';

type DependencyState = Readonly<{ pricing: boolean; inventory: boolean; qualification: boolean }>;

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

  items(
    listings: readonly StorefrontListing[],
    prices: readonly StorefrontPrice[],
    availability: readonly StorefrontAvailability[],
    qualifications: readonly CatalogQualificationDecision[],
    dependencies: DependencyState
  ): readonly Readonly<Record<string, unknown>>[] {
    const priceBySku = new Map(prices.map((item) => [item.sku, item]));
    const stockBySku = new Map(availability.map((item) => [item.sku, item]));
    const qualificationByListing = new Map(qualifications.map((item) => [item.listing, item]));
    return Object.freeze(
      listings.map((listing) => {
        const { categoryId, categoryCode, categoryName, brandId, supplierId, ...catalog } = listing;
        const price = priceBySku.get(listing.sku) ?? null;
        const stock = stockBySku.get(listing.sku) ?? null;
        const qualificationDecision = qualificationByListing.get(listing.id) ?? null;
        const qualification = qualificationDecision === null ? null : Object.freeze({ eligible: qualificationDecision.eligible, policyVersion: qualificationDecision.policyVersion });
        const reasons = Object.freeze([
          ...(!dependencies.qualification || qualification === null ? ['qualification_unavailable' as const] : qualification.eligible ? [] : ['qualification_failed' as const]),
          ...(!dependencies.pricing || price === null ? ['price_unavailable' as const] : []),
          ...(!dependencies.inventory || stock === null ? ['inventory_unavailable' as const] : stock.state !== 'available' || stock.available <= 0 ? ['out_of_stock' as const] : []),
        ]);
        return Object.freeze({
          ...catalog,
          category: Object.freeze({ id: categoryId, code: categoryCode, name: categoryName }),
          brandId,
          supplierId,
          price,
          availability: stock,
          qualification,
          saleability: Object.freeze({ state: reasons.length === 0 ? ('saleable' as const) : ('blocked' as const), reasons }),
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
