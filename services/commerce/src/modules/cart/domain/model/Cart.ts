import type { CartPolicy } from '../policy/CartPolicy';
import type { CartChange, CartLine, CartLineView, CartMergePlan, CartOffer, CartPlan } from './CartLine';

export type CartOwner =
  | Readonly<{ kind: 'member'; member: string; mall: string; application: string }>
  | Readonly<{ kind: 'anonymous'; tokenDigest: string; mall: string; application: string }>;

export class Cart {
  readonly id: string;
  readonly owner: CartOwner;
  readonly version: number;
  readonly updatedAt: Date | string;
  readonly lines: readonly CartLine[];

  constructor(value: Readonly<{ id: string; owner: CartOwner; version: number; updatedAt: Date | string; lines: readonly CartLine[] }>) {
    this.id = value.id;
    this.owner = Object.freeze({ ...value.owner });
    this.version = value.version;
    this.updatedAt = value.updatedAt;
    this.lines = Object.freeze(value.lines.map((line) => Object.freeze({ ...line })));
    Object.freeze(this);
  }

  plan(policy: CartPolicy, changes: readonly CartChange[], offers: ReadonlyMap<string, CartOffer>): CartPlan {
    return policy.plan(this.lines, changes, offers);
  }

  merge(policy: CartPolicy, source: Cart): CartMergePlan {
    return policy.merge(this.lines, source.lines);
  }
}

export interface CartView {
  readonly id: string | null;
  readonly mall_id: string | null;
  readonly application_id: string | null;
  readonly version: number;
  readonly updated_at: string | null;
  readonly merge: 'none' | 'completed' | 'blocked';
  readonly merge_reason: string | null;
  readonly items: readonly CartLineView[];
}

export function cartView(cart: Cart | null, lines: readonly CartLineView[], merge: Readonly<{ state: CartView['merge']; reason: string | null }> = { state: 'none', reason: null }): CartView {
  return Object.freeze({
    id: cart?.id ?? null,
    mall_id: cart?.owner.mall ?? null,
    application_id: cart?.owner.application ?? null,
    version: cart?.version ?? 0,
    updated_at: cart ? new Date(cart.updatedAt).toISOString() : null,
    merge: merge.state,
    merge_reason: merge.reason,
    items: Object.freeze(lines),
  });
}
