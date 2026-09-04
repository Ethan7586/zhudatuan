import type { ApiProduct } from './productionApi.types';
import { boolean, nextCursor, nonNegativeInteger, optionalText, pageItems, text } from './canonicalShape';

export interface CanonicalProductPage {
  readonly items: ApiProduct[];
  readonly pagination: { readonly nextCursor: string | null };
}

export function mapCanonicalProductPage(listingValue: unknown, offerValue: unknown, inventoryValue: unknown): CanonicalProductPage {
  const offers = new Map<string, ReturnType<typeof offer>>();
  for (const item of pageItems(offerValue, 'pricing.offers')) {
    const mapped = offer(item);
    if (!offers.has(mapped.skuId)) offers.set(mapped.skuId, mapped);
  }
  const inventory = new Map<string, number>();
  for (const item of pageItems(inventoryValue, 'inventory.availability')) {
    const sku = text(item.sku_id, 'inventory.sku_id');
    const available = nonNegativeInteger(item.available, 'inventory.available');
    inventory.set(sku, (inventory.get(sku) ?? 0) + available);
  }

  const items = pageItems(listingValue, 'catalog.listings').map((listing) => {
    const skuId = text(listing.sku_id, 'catalog.listing.sku_id');
    const pricing = offers.get(skuId);
    const availableStock = inventory.get(skuId) ?? 0;
    const priceAvailable = pricing?.currency === 'CNY';
    const purchasable = priceAvailable && availableStock > 0 && listing.status === 'published';
    const purchaseReason = !priceAvailable ? 'PRICE_UNAVAILABLE' : availableStock <= 0 ? 'OUT_OF_STOCK' : purchasable ? 'QUALIFIED' : 'LISTING_UNAVAILABLE';
    const categoryCode = category(optionalText(listing.product_type));
    return {
      id: text(listing.id, 'catalog.listing.id'),
      skuId,
      name: text(listing.title, 'catalog.listing.title'),
      subtitle: optionalText(listing.subtitle),
      categoryCode,
      coverUrl: optionalText(listing.cover_url),
      priceCents: priceAvailable ? pricing!.amountMinor : 0,
      marketPriceCents: priceAvailable ? pricing!.compareMinor : null,
      availableStock,
      supplierName: '供应方待服务端补全',
      isTest: boolean(listing.is_test),
      purchasable,
      qualification: {
        visible: true,
        purchasable,
        visibilityReason: 'CANONICAL_LISTING',
        purchaseReason,
      },
    } satisfies ApiProduct;
  });
  return { items, pagination: { nextCursor: nextCursor(listingValue) } };
}

function offer(item: Record<string, unknown>) {
  return {
    skuId: text(item.sku_id, 'pricing.offer.sku_id'),
    amountMinor: nonNegativeInteger(item.amount_minor, 'pricing.offer.amount_minor'),
    compareMinor: item.compare_minor === null || item.compare_minor === undefined ? null : nonNegativeInteger(item.compare_minor, 'pricing.offer.compare_minor'),
    currency: text(item.currency, 'pricing.offer.currency'),
  };
}

function category(productType: string | null): string {
  if (productType === 'virtual' || productType === 'virtual_coupon') return 'virtual-card';
  if (productType === 'service') return 'life';
  return 'welfare';
}
