import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { cartConflict, listingUnavailable } from '../../domain/error/CartError';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import { CartActor } from '../service/CartActor';
import { ChangeCart } from '../service/ChangeCart';

export class ItemsPutHandler implements OperationHandler<'cart.items.put', 'write'> {
  readonly operation = 'cart.items.put' as const;
  readonly mode = 'write' as const;
  private readonly policy = new CartPolicy();
  constructor(
    private readonly actor: CartActor,
    private readonly change: ChangeCart
  ) {}
  async execute(input: OperationInputFor<'cart.items.put'>, context: WriteHandlerContext<'cart.items.put'>): Promise<OperationReply<OperationOutputFor<'cart.items.put'>>> {
    const body = bodyRecord(input);
    const changed = await this.change.execute(
      context.transaction,
      await this.actor.write(context),
      context.expectedVersion ?? cartConflict(),
      [this.policy.change({ listing: input.path.listingid, quantity: body.quantity, selected: body.selected, lineVersion: body.lineVersion })],
      true
    );
    const result = changed.results[0];
    if (result?.outcome === 'failed') return result.reason === 'versionconflict' ? cartConflict() : listingUnavailable();
    return { status: 200, body: changed.cart as OperationOutputFor<'cart.items.put'> };
  }
}
