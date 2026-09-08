import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CheckoutRepository } from '../port/CheckoutRepository';
import type { CheckoutFinalizer } from '../port/CheckoutFinalizer';

export class ConfirmQuoteHandler implements DurableOperationHandler<'order.orders.create', undefined, OperationReply<OperationOutputFor<'order.orders.create'>>, 'write'> {
  readonly operation = 'order.orders.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly checkouts: CheckoutRepository,
    private readonly confirmation: CheckoutFinalizer
  ) {}

  async prepare(_input: OperationInputFor<'order.orders.create'>, _context: PrepareContext<'order.orders.create'>): Promise<undefined> {
    return undefined;
  }

  async commit(
    input: OperationInputFor<'order.orders.create'>,
    _prepared: undefined,
    context: CommitContext<'order.orders.create'>
  ): Promise<DurableCommit<OperationReply<OperationOutputFor<'order.orders.create'>>, OperationOutputFor<'order.orders.create'>>> {
    const response = await this.checkouts.confirm(context.transaction, input, context);
    return { checkpoint: response, response };
  }

  finalize(input: OperationInputFor<'order.orders.create'>, checkpoint: OperationReply<OperationOutputFor<'order.orders.create'>>, context: FinalizeContext<'order.orders.create'>) {
    return this.confirmation.finalizeRequest(input, context, checkpoint);
  }
}
