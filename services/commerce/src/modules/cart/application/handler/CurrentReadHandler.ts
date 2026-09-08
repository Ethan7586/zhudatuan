import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CartRepository } from '../port/CartRepository';
import { CartActor } from '../service/CartActor';
import { CartReader } from '../service/CartReader';

export class CurrentReadHandler implements OperationHandler<'cart.current.read', 'read'> {
  readonly operation = 'cart.current.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly carts: CartRepository,
    private readonly actor: CartActor,
    private readonly reader: CartReader
  ) {}
  async execute(_input: OperationInputFor<'cart.current.read'>, context: HandlerContext<'cart.current.read'>): Promise<OperationReply<OperationOutputFor<'cart.current.read'>>> {
    const owner = await this.actor.read(context);
    const cart = owner ? await this.carts.current(context.transaction, owner) : null;
    return { status: 200, body: (await this.reader.read(context.transaction, cart)) as OperationOutputFor<'cart.current.read'> };
  }
}
