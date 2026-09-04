import { Money } from '@shop/kernel';
import type { QuoteLine } from '../../domain/model/CheckoutQuote';
import { applies, eligible, type CartRow, type LineRow, type PolicyRow, type PurchaseRow } from './QuoteCalculations';

export function evaluateLine(source: LineRow, cart: CartRow, policies: readonly PolicyRow[], purchases: ReadonlyMap<string, PurchaseRow>, tags: ReadonlySet<string>): QuoteLine {
  const reasons: string[] = [];
  if (!source.listing_id || source.listing_status !== 'published' || source.product_id === null) reasons.push('LISTING_NOT_PURCHASABLE');
  if (source.listing_version === null) reasons.push('LISTING_VERSION_CHANGED');
  if (source.unit_minor === null || source.currency !== 'CNY') reasons.push('PRICE_UNAVAILABLE');
  if (source.stockitem_id === null) reasons.push('INVENTORY_UNAVAILABLE');
  else if ((source.onhand ?? 0) - (source.safety ?? 0) - (source.reserved ?? 0) < source.quantity) reasons.push('INVENTORY_INSUFFICIENT');
  if (cart.profile_status !== 'active') reasons.push('MEMBER_PROFILE_INACTIVE');
  if (cart.qualification_status !== 'active' || cart.profile_version === null) reasons.push('QUALIFICATION_PROFILE_INACTIVE');
  if (cart.experience_version === null) reasons.push('EXPERIENCE_NOT_PUBLISHED');
  if (source.product_type === 'physical' && cart.address_version === null) reasons.push('ADDRESS_REQUIRED');
  for (const policy of policies) if (applies(policy, source) && !eligible(policy, source, cart, purchases.get(source.listing_id), tags)) reasons.push(`QUALIFICATION_DENIED:${policy.id}`);
  const unit = Money.of(source.unit_minor ?? 0);
  const total = unit.multiply(source.quantity);
  return Object.freeze({
    listing: source.listing_id,
    sku: source.sku_id,
    product: source.product_id ?? '',
    productType: source.product_type ?? 'unknown',
    category: source.category_id ?? '',
    title: source.listing_title ?? source.listing_id,
    quantity: source.quantity,
    unitMinor: unit.minor,
    totalMinor: total.minor,
    discountMinor: 0,
    payableMinor: total.minor,
    provider: source.provider,
    partner: source.partner_id,
    stockitem: source.stockitem_id,
    versions: Object.freeze({
      cartLine: source.cart_line_version,
      listing: source.listing_version ?? -1,
      product: source.product_version ?? -1,
      sku: source.sku_version ?? -1,
      price: source.price_version ?? '',
      stock: source.stock_version ?? -1,
    }),
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}
