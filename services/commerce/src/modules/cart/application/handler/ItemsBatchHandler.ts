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

export class ItemsBatchHandler implements OperationHandler<'cart.items.batch', 'write'> {
  readonly operation = 'cart.items.batch' as const;
  readonly mode = 'write' as const;
  private readonly policy = new CartPolicy();
  constructor(
    private readonly carts: CartRepository,
    private readonly owners: CartOwnerRepository,
    private readonly offers: CartOfferRepository
  ) {}
  async execute(input: OperationInputFor<'cart.items.batch'>, context: WriteHandlerContext<'cart.items.batch'>): Promise<OperationReply<OperationOutputFor<'cart.items.batch'>>> {
    const expectedVersion = context.expectedVersion ?? cartConflict();
    const changes = this.policy.batch(input);
    const owner = await this.owners.resolve(context.transaction, requireSession(context.security).membership.id);
    if (!owner.application) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
    const cart = await this.carts.lockExisting(context.transaction, owner.member, owner.mall, owner.application, expectedVersion);
    const versions = await this.carts.lineVersions(
      context.transaction,
      cart,
      changes.map(({ listing }) => listing)
    );
    for (const change of changes) {
      const actual = versions.get(change.listing);
      if (actual === undefined ? change.lineVersion !== null : actual !== change.lineVersion) return cartConflict();
    }
    const positive = changes.filter(({ quantity }) => quantity > 0);
    const offers = await this.offers.resolve(
      context.transaction,
      owner.mall,
      positive.map(({ listing }) => listing)
    );
    if (positive.some(({ listing }) => !offers.has(listing))) return listingUnavailable();
    const mutations: readonly CartLineMutation[] = changes.map((change) => {
      const offer = offers.get(change.listing);
      return Object.freeze({
        listing: change.listing,
        quantity: change.quantity,
        version: change.lineVersion,
        sku: offer?.sku ?? '',
        title: offer?.title ?? '',
        listingVersion: offer?.listingVersion ?? '',
        unitMinor: offer?.unitMinor ?? 0,
        currency: offer?.currency ?? '',
        priceVersion: offer?.priceVersion ?? '',
      });
    });
    await this.carts.mutate(context.transaction, cart, mutations);
    return { status: 200, body: (await this.carts.snapshot(context.transaction, cart)) as OperationOutputFor<'cart.items.batch'> };
  }
}
