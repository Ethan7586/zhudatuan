import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { cartInvalid } from '../error/CartError';
import type { CartChange, CartItemResult, CartLine, CartLineMutation, CartLineView, CartMergePlan, CartOffer, CartPlan, CartValidityCode } from '../model/CartLine';

export interface CartChangeInput {
  readonly listing: unknown;
  readonly quantity: unknown;
  readonly selected?: unknown;
  readonly lineVersion: unknown;
}

const MESSAGES: Readonly<Record<CartValidityCode, string>> = Object.freeze({
  valid: '商品可购买',
  unpublished: '商品已下架，仍为您保留在购物车中',
  unavailable: '商品暂不可用，仍为您保留在购物车中',
  outofscope: '商品不属于当前商城',
  unpriced: '商品价格暂不可用，请稍后重试',
  outofstock: '商品库存不足，请调整数量',
  variantchanged: '商品规格已变化，请重新选择',
});

export class CartPolicy {
  constructor(
    private readonly maximumLines: number = RUNTIME_LIMITS.cart.maximumLines,
    private readonly maximumQuantity: number = RUNTIME_LIMITS.cart.maximumQuantity,
    private readonly maximumBatchItems: number = RUNTIME_LIMITS.cart.maximumBatchItems
  ) {}

  batch(entries: readonly CartChangeInput[]): readonly CartChange[] {
    if (entries.length < 1 || entries.length > this.maximumBatchItems) return cartInvalid('items');
    return Object.freeze(entries.map((entry) => this.change(entry, 'items.quantity')));
  }

  plan(lines: readonly CartLine[], changes: readonly CartChange[], offers: ReadonlyMap<string, CartOffer>): CartPlan {
    const current = new Map(lines.map((line) => [line.listing, { ...line }]));
    const mutations: CartLineMutation[] = [];
    const results: CartItemResult[] = [];
    for (const change of changes) {
      const existing = current.get(change.listing);
      if ((existing?.version ?? null) !== change.lineVersion) {
        results.push(result(change.listing, change.listing, 'failed', 'versionconflict', existing?.version ?? null));
        continue;
      }
      if (change.quantity === 0) {
        if (!existing) results.push(result(change.listing, change.listing, 'skipped', 'notfound', null));
        else {
          mutations.push(Object.freeze({ ...existing, quantity: 0, version: existing.version }));
          current.delete(existing.listing);
          results.push(result(change.listing, existing.listing, 'succeeded', null, null));
        }
        continue;
      }
      const offer = offers.get(change.listing);
      if (!offer || offer.code !== 'valid') {
        results.push(result(change.listing, change.listing, 'failed', offer?.code ?? 'unpublished', existing?.version ?? null));
        continue;
      }
      if (existing && existing.sku !== offer.sku) {
        results.push(result(change.listing, change.listing, 'failed', 'variantchanged', existing.version));
        continue;
      }
      const sameSku = [...current.values()].find((line) => line.sku === offer.sku && line.listing !== change.listing);
      const target = existing ?? sameSku;
      const quantity = sameSku && !existing ? sameSku.quantity + change.quantity : change.quantity;
      if (quantity > this.maximumQuantity) {
        results.push(result(change.listing, target?.listing ?? change.listing, 'failed', 'quantitylimit', target?.version ?? null));
        continue;
      }
      if (offer.available !== null && offer.available < quantity) {
        results.push(result(change.listing, target?.listing ?? change.listing, 'failed', 'outofstock', target?.version ?? null));
        continue;
      }
      if (!target && current.size >= this.maximumLines) {
        results.push(result(change.listing, change.listing, 'failed', 'linelimit', null));
        continue;
      }
      const mutation = Object.freeze({ listing: target?.listing ?? change.listing, sku: offer.sku, quantity, selected: change.selected ?? target?.selected ?? true, version: target?.version ?? null });
      mutations.push(mutation);
      const next = { ...mutation, version: (target?.version ?? -1) + 1 };
      current.set(mutation.listing, next);
      results.push(result(change.listing, mutation.listing, 'succeeded', null, next.version));
    }
    return Object.freeze({ mutations: compact(mutations), results: Object.freeze(results) });
  }

  merge(target: readonly CartLine[], source: readonly CartLine[]): CartMergePlan {
    const current = new Map(target.map((line) => [line.sku, { ...line }]));
    const listings = new Map(target.map((line) => [line.listing, line.sku]));
    const mutations: CartLineMutation[] = [];
    for (const incoming of [...source].sort((left, right) => left.sku.localeCompare(right.sku) || left.listing.localeCompare(right.listing))) {
      const existing = current.get(incoming.sku);
      if (!existing && (current.size >= this.maximumLines || (listings.has(incoming.listing) && listings.get(incoming.listing) !== incoming.sku))) {
        return Object.freeze({ blocked: 'linelimit', mutations: Object.freeze([]) });
      }
      const quantity = (existing?.quantity ?? 0) + incoming.quantity;
      if (quantity > this.maximumQuantity) return Object.freeze({ blocked: 'quantitylimit', mutations: Object.freeze([]) });
      const mutation = Object.freeze({ listing: existing?.listing ?? incoming.listing, sku: incoming.sku, quantity, selected: Boolean(existing?.selected || incoming.selected), version: existing?.version ?? null });
      mutations.push(mutation);
      current.set(incoming.sku, { ...mutation, version: (existing?.version ?? -1) + 1 });
      listings.set(mutation.listing, incoming.sku);
    }
    return Object.freeze({ blocked: null, mutations: Object.freeze(mutations) });
  }

  present(line: CartLine, offer: CartOffer | undefined): CartLineView {
    const code: CartValidityCode = !offer ? 'unpublished' : offer.code !== 'valid' ? offer.code : offer.sku !== line.sku ? 'variantchanged' : offer.available !== null && offer.available < line.quantity ? 'outofstock' : 'valid';
    return Object.freeze({
      ...line,
      title: offer?.title ?? '已失效商品',
      amountMinor: offer?.amountMinor ?? null,
      currency: offer?.currency ?? null,
      available: offer?.available ?? null,
      benefitApplicable: offer?.benefitApplicable ?? false,
      validity: Object.freeze({ state: code === 'valid' ? 'valid' : 'invalid', code, message: MESSAGES[code] }),
    });
  }

  change(input: CartChangeInput, quantityField = 'quantity'): CartChange {
    if (typeof input.listing !== 'string' || !input.listing || input.listing.length > 256 || /\s/.test(input.listing)) return cartInvalid('listingId');
    const quantity = input.quantity;
    if (!Number.isSafeInteger(quantity) || (quantity as number) < 0) return cartInvalid(quantityField);
    const validQuantity = quantity as number;
    if (validQuantity > this.maximumQuantity) return cartInvalid(quantityField);
    const selected = input.selected;
    if (selected !== undefined && typeof selected !== 'boolean') return cartInvalid('selected');
    return Object.freeze({ listing: input.listing, quantity: validQuantity, selected: selected ?? null, lineVersion: this.version(input.lineVersion, 'lineVersion') });
  }

  private version(value: unknown, field: string): number | null {
    if (value === null) return null;
    if (!Number.isSafeInteger(value) || (value as number) < 0) return cartInvalid(field);
    return value as number;
  }
}

function result(requestedListing: string, listing: string, outcome: CartItemResult['outcome'], reason: string | null, lineVersion: number | null): CartItemResult {
  return Object.freeze({ requestedListing, listing, outcome, reason, lineVersion });
}

function compact(mutations: readonly CartLineMutation[]): readonly CartLineMutation[] {
  const result = new Map<string, CartLineMutation>();
  for (const mutation of mutations) {
    const first = result.get(mutation.listing);
    result.set(mutation.listing, Object.freeze({ ...mutation, version: first ? first.version : mutation.version }));
  }
  return Object.freeze([...result.values()]);
}
