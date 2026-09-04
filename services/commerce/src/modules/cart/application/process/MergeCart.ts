import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartOwner } from '../../domain/model/Cart';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import type { CartRepository } from '../port/CartRepository';
import type { CartMergeNotice } from '../service/CartReader';

export class MergeCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly policy = new CartPolicy()
  ) {}

  async execute(context: WriteTransactionContext, tokenDigest: string, owner: Extract<CartOwner, { kind: 'member' }>): Promise<Readonly<{ cart: import('../../domain/model/Cart').Cart | null; notice: CartMergeNotice }>> {
    const prepared = await this.carts.prepareMerge(context, tokenDigest, owner);
    if (prepared.state === 'none') return Object.freeze({ cart: await this.carts.current(context, owner), notice: Object.freeze({ state: 'none', reason: null }) });
    if (prepared.state === 'completed') return Object.freeze({ cart: await this.carts.current(context, owner), notice: Object.freeze({ state: 'completed', reason: null }) });
    const plan = prepared.target.merge(this.policy, prepared.source);
    if (plan.blocked) return Object.freeze({ cart: prepared.target, notice: Object.freeze({ state: 'blocked', reason: plan.blocked }) });
    const cart = await this.carts.completeMerge(context, prepared.source, prepared.target, plan.mutations);
    return Object.freeze({ cart, notice: Object.freeze({ state: 'completed', reason: null }) });
  }
}
