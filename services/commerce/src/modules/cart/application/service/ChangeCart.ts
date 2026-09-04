import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartOwner, CartView } from '../../domain/model/Cart';
import type { CartChange, CartItemResult } from '../../domain/model/CartLine';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import type { CartOfferRepository } from '../port/CartOfferRepository';
import type { CartRepository } from '../port/CartRepository';
import { CartReader } from './CartReader';

export class ChangeCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly offers: CartOfferRepository,
    private readonly reader: CartReader,
    private readonly policy = new CartPolicy()
  ) {}

  async execute(
    context: WriteTransactionContext,
    owner: CartOwner,
    expectedVersion: number,
    changes: readonly CartChange[],
    create: boolean
  ): Promise<Readonly<{ cart: CartView; results: readonly CartItemResult[] }>> {
    const cart = create
      ? await this.carts.lockOrCreate(context, owner, expectedVersion)
      : await this.carts.lockExisting(context, owner, expectedVersion);
    const existing = new Map(cart.lines.map((line) => [line.listing, line]));
    const offers = await this.offers.resolve(
      context,
      owner.mall,
      changes.filter(({ quantity }) => quantity > 0).map(({ listing }) => ({ listing, sku: existing.get(listing)?.sku ?? null }))
    );
    const plan = cart.plan(this.policy, changes, offers);
    const latest = plan.mutations.length > 0 ? await this.carts.mutate(context, cart, plan.mutations) : cart;
    const versions = new Map(latest.lines.map((line) => [line.listing, line.version]));
    const results = plan.results.map((item) => item.outcome === 'succeeded' ? Object.freeze({ ...item, lineVersion: versions.get(item.listing) ?? null }) : item);
    return Object.freeze({ cart: await this.reader.read(context, latest), results: Object.freeze(results) });
  }
}
