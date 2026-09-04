import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Cart, CartView } from '../../domain/model/Cart';
import { cartView } from '../../domain/model/Cart';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import type { CartOfferRepository } from '../port/CartOfferRepository';

export interface CartMergeNotice {
  readonly state: CartView['merge'];
  readonly reason: string | null;
}

export class CartReader {
  constructor(
    private readonly offers: CartOfferRepository,
    private readonly policy = new CartPolicy()
  ) {}

  async read(context: ReadTransactionContext, cart: Cart | null, notice?: CartMergeNotice): Promise<CartView> {
    if (!cart) return cartView(null, [], notice);
    const offers = await this.offers.resolve(
      context,
      cart.owner.mall,
      cart.lines.map(({ listing, sku }) => ({ listing, sku }))
    );
    return cartView(cart, cart.lines.map((line) => this.policy.present(line, offers.get(line.listing))), notice);
  }
}
