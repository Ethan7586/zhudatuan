import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext, PrepareContext, WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { TransactionMode } from '../../../../platform/database/TransactionContext';

type Reply<TKey extends OperationId> = OperationReply<OperationOutputFor<TKey>>;
type Context<TKey extends OperationId, TMode extends TransactionMode> = TMode extends 'write' ? WriteHandlerContext<TKey> : HandlerContext<TKey>;

export abstract class PreparedOperation<TKey extends OperationId, TPrepared, TMode extends TransactionMode> implements DurableOperationHandler<TKey, TPrepared, Reply<TKey>, TMode> {
  abstract readonly operation: TKey;
  abstract readonly mode: TMode;

  constructor(private readonly prepareValue: (input: OperationInputFor<TKey>, context: PrepareContext<TKey>) => Promise<TPrepared>) {}

  abstract commit(input: OperationInputFor<TKey>, prepared: TPrepared, context: Context<TKey, TMode>): Promise<DurableCommit<Reply<TKey>, OperationOutputFor<TKey>>>;

  prepare(input: OperationInputFor<TKey>, context: PrepareContext<TKey>): Promise<TPrepared> {
    return this.prepareValue(input, context);
  }

  protected async reply(value: Promise<Reply<TKey>>): Promise<DurableCommit<Reply<TKey>, OperationOutputFor<TKey>>> {
    const response = await value;
    return { checkpoint: response, response };
  }

  finalize(_input: OperationInputFor<TKey>, response: Reply<TKey>): Promise<Reply<TKey>> {
    return Promise.resolve(response);
  }
}
