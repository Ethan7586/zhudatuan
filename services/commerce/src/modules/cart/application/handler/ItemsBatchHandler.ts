import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { cartInvalid } from '../../domain/error/CartError';
import { cartConflict } from '../../domain/error/CartError';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import { CartActor } from '../service/CartActor';
import { ChangeCart } from '../service/ChangeCart';

export class ItemsBatchHandler implements OperationHandler<'cart.items.batch', 'write'> {
  readonly operation = 'cart.items.batch' as const;
  readonly mode = 'write' as const;
  private readonly policy = new CartPolicy();
  constructor(
    private readonly actor: CartActor,
    private readonly change: ChangeCart
  ) {}
  async execute(input: OperationInputFor<'cart.items.batch'>, context: WriteHandlerContext<'cart.items.batch'>): Promise<OperationReply<OperationOutputFor<'cart.items.batch'>>> {
    const items = bodyRecord(input).items;
    if (!Array.isArray(items)) return cartInvalid('items');
    const changed = await this.change.execute(
      context.transaction,
      await this.actor.write(context),
      context.expectedVersion ?? cartConflict(),
      this.policy.batch(
        items.map((item) => {
          const value = bodyRecord({ body: item });
          return { listing: value.listingId, quantity: value.quantity, selected: value.selected, lineVersion: value.lineVersion };
        })
      ),
      false
    );
    return {
      status: 200,
      body: Object.freeze({
        ...changed.cart,
        results: changed.results.map((item) => Object.freeze({ requestedListing: item.requestedListing, listing: item.listing, outcome: item.outcome, reason: item.reason, lineVersion: item.lineVersion })),
      }) as OperationOutputFor<'cart.items.batch'>,
    };
  }
}
