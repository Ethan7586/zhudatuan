import { Money } from '@shop/kernel';
import type { QuoteLine } from '../../domain/model/CheckoutQuote';
import type { CartItemSnapshot } from '../../../cart/public';
import { quoteHash } from '../../domain/service/QuoteSigner';

export interface CartRow {
  readonly id: string;
  readonly member_id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly version: number;
  readonly profile_status: string | null;
  readonly qualification_status: string | null;
  readonly profile_version: number | null;
  readonly city_code: string | null;
  readonly address_version: number | null;
  readonly address_region: string | null;
  readonly address_snapshot: unknown | null;
  readonly invoice_version: number | null;
  readonly invoice_snapshot: unknown | null;
  readonly experience_version: string | null;
  readonly experience_hash: string | null;
  readonly items: readonly CartItemSnapshot[];
}
export interface LineRow {
  readonly listing_id: string;
  readonly sku_id: string;
  readonly quantity: number;
  readonly cart_line_version: number;
  readonly listing_title: string | null;
  readonly listing_version: number | null;
  readonly listing_status: string | null;
  readonly product_id: string | null;
  readonly product_type: string | null;
  readonly category_id: string | null;
  readonly product_version: number | null;
  readonly sku_version: number | null;
  readonly image_reference: string | null;
  readonly image_url: string | null;
  readonly unit_minor: number | null;
  readonly price_version: string | null;
  readonly price_breakdown: readonly Readonly<{ kind: string; label: string; amountMinor: number }>[];
  readonly currency: string | null;
  readonly stockitem_id: string | null;
  readonly onhand: number | null;
  readonly safety: number | null;
  readonly reserved: number | null;
  readonly stock_version: number | null;
  readonly provider: string | null;
  readonly partner_id: string | null;
}
export interface PolicyRow {
  readonly id: string;
  readonly version: number;
  readonly rule_hash: string;
  readonly rule: Record<string, unknown>;
  readonly resources: readonly Readonly<{ kind: string; id: string }>[];
  readonly subjects: readonly Readonly<Record<string, unknown>>[];
  readonly period: string | null;
  readonly quantity: number | null;
  readonly amount_minor: number | null;
}
export interface PurchaseRow {
  readonly listing_id: string;
  readonly day_quantity: number;
  readonly week_quantity: number;
  readonly month_quantity: number;
  readonly lifetime_quantity: number;
  readonly day_minor: number;
  readonly week_minor: number;
  readonly month_minor: number;
  readonly lifetime_minor: number;
}
export function applies(policy: PolicyRow, line: LineRow): boolean {
  return policy.resources.length === 0 || policy.resources.some((resource) => resource.id === line.listing_id || resource.id === line.sku_id || resource.id === line.product_id);
}

export function eligible(policy: PolicyRow, line: LineRow, cart: CartRow, purchase: PurchaseRow | undefined, tags: ReadonlySet<string>): boolean {
  const rule = policy.rule;
  if (rule.effect === 'deny' || rule.allowed === false) return false;
  const cities = strings(rule.cityCodes);
  if (cities.length > 0 && !cities.includes(cart.address_region ?? cart.city_code ?? '')) return false;
  const required = [...strings(rule.requiredTags), ...policy.subjects.flatMap((subject) => (typeof subject.tag === 'string' ? [subject.tag] : []))];
  if (required.some((tag) => !tags.has(tag)) || strings(rule.excludedTags).some((tag) => tags.has(tag))) return false;
  if (policy.period === null) return true;
  const priorQuantity = period(purchase, policy.period, 'quantity');
  const priorMinor = period(purchase, policy.period, 'minor');
  return (policy.quantity === null || priorQuantity + line.quantity <= policy.quantity) && (policy.amount_minor === null || priorMinor + (line.unit_minor ?? 0) * line.quantity <= policy.amount_minor);
}

export function period(row: PurchaseRow | undefined, value: string, kind: 'quantity' | 'minor'): number {
  if (!row || value === 'order') return 0;
  const key = `${value}_${kind}` as keyof PurchaseRow;
  const result = row[key];
  return typeof result === 'number' ? result : 0;
}

export function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
export function quoteDigest(value: unknown): string {
  return quoteHash(value);
}

export function allocateLineDiscount(lines: readonly QuoteLine[], discount: Money, subtotal: Money): readonly QuoteLine[] {
  if (discount.minor === 0) return Object.freeze(lines.map((line) => Object.freeze({ ...line })));
  if (subtotal.minor <= 0 || discount.minor < 0 || discount.minor > subtotal.minor) throw new Error('CHECKOUT_DISCOUNT_INVALID');
  const allocations = lines.map((line, index) => {
    if (!line.accepted) return { index, amount: 0, remainder: 0 };
    const lineTotal = Money.of(line.totalMinor, subtotal.currency.code);
    const numerator = BigInt(lineTotal.minor) * BigInt(discount.minor);
    return { index, amount: lineTotal.multiplyRatio(discount.minor, subtotal.minor).minor, remainder: Number(numerator % BigInt(subtotal.minor)) };
  });
  let remaining = discount.minor - allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const priority = allocations
    .filter(({ index }) => lines[index]!.accepted)
    .sort((left, right) => right.remainder - left.remainder || lines[left.index]!.sku.localeCompare(lines[right.index]!.sku) || lines[left.index]!.listing.localeCompare(lines[right.index]!.listing));
  if (remaining > priority.length) throw new Error('CHECKOUT_DISCOUNT_ALLOCATION_FAILED');
  for (let index = 0; index < remaining; index += 1) priority[index]!.amount += 1;
  const result = lines.map((line, index) => {
    const lineDiscount = Money.of(allocations[index]!.amount, subtotal.currency.code);
    return Object.freeze({ ...line, discountMinor: lineDiscount.minor, payableMinor: Money.of(line.totalMinor, subtotal.currency.code).subtract(lineDiscount).minor });
  });
  remaining = result.reduce((sum, line) => sum + line.discountMinor, 0);
  if (remaining !== discount.minor || result.reduce((sum, line) => sum + (line.accepted ? line.payableMinor : 0), 0) !== subtotal.subtract(discount).minor) {
    throw new Error('CHECKOUT_DISCOUNT_ALLOCATION_FAILED');
  }
  return Object.freeze(result);
}
