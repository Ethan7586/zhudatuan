import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { MergeCart } from '../process/MergeCart';
import { CartActor } from '../service/CartActor';
import { CartReader } from '../service/CartReader';

export class MergeCartHandler implements OperationHandler<'cart.anonymous.merge', 'write'> {
  readonly operation = 'cart.anonymous.merge' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly actor: CartActor,
    private readonly merge: MergeCart,
    private readonly reader: CartReader
  ) {}
  async execute(_input: OperationInputFor<'cart.anonymous.merge'>, context: WriteHandlerContext<'cart.anonymous.merge'>): Promise<OperationReply<OperationOutputFor<'cart.anonymous.merge'>>> {
    const owner = await this.actor.member(context);
    const merged = await this.merge.execute(context.transaction, this.actor.token(context), owner);
    return { status: 200, body: (await this.reader.read(context.transaction, merged.cart, merged.notice)) as OperationOutputFor<'cart.anonymous.merge'> };
  }
}
