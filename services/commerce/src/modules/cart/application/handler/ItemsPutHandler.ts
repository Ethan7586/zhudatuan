import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { cartConflict, listingUnavailable } from '../../domain/error/CartError';
import type { CartLineMutation } from '../../domain/model/CartLine';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import type { CartOfferRepository } from '../port/CartOfferRepository';
import type { CartOwnerRepository } from '../port/CartOwnerRepository';
import type { CartRepository } from '../port/CartRepository';

export class ItemsPutHandler implements OperationHandler<'cart.items.put', 'write'> {
  readonly operation = 'cart.items.put' as const;
  readonly mode = 'write' as const;
  private readonly policy = new CartPolicy();
  constructor(
    private readonly carts: CartRepository,
    private readonly owners: CartOwnerRepository,
    private readonly offers: CartOfferRepository
  ) {}
  async execute(input: OperationInputFor<'cart.items.put'>, context: WriteHandlerContext<'cart.items.put'>): Promise<OperationReply<OperationOutputFor<'cart.items.put'>>> {
    const expectedVersion = context.expectedVersion ?? cartConflict();
    const change = this.policy.put(input);
    const owner = await this.owners.resolve(context.transaction, requireSession(context.security).membership.id);
    if (!owner.application) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
    const cart = await this.carts.lockOrCreate(context.transaction, owner.member, owner.mall, owner.application, expectedVersion);
    const actual = (await this.carts.lineVersions(context.transaction, cart, [change.listing])).get(change.listing);
    if (actual === undefined ? change.lineVersion !== null : actual !== change.lineVersion) return cartConflict();
    let mutation: CartLineMutation;
    if (change.quantity === 0) mutation = Object.freeze({ listing: change.listing, quantity: 0, version: change.lineVersion, sku: '', title: '', listingVersion: '', unitMinor: 0, currency: '', priceVersion: '' });
    else {
      const offer = (await this.offers.resolve(context.transaction, owner.mall, [change.listing])).get(change.listing);
      if (!offer) return listingUnavailable();
      mutation = Object.freeze({ ...offer, quantity: change.quantity, version: change.lineVersion });
    }
    await this.carts.mutate(context.transaction, cart, [mutation]);
    return { status: 200, body: (await this.carts.snapshot(context.transaction, cart)) as OperationOutputFor<'cart.items.put'> };
  }
}
