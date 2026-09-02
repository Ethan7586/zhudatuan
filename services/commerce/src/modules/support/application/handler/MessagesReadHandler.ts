import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { MessageReader } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.messages.read'>>;

export class MessagesReadHandler implements DurableOperationHandler<'support.messages.read', undefined, Reply, 'read'> {
  readonly operation = 'support.messages.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly messages: MessageReader) {}
  async prepare(_input: OperationInputFor<'support.messages.read'>, _context: PrepareContext<'support.messages.read'>): Promise<undefined> {
    return undefined;
  }
  async commit(input: OperationInputFor<'support.messages.read'>, _prepared: undefined, context: HandlerContext<'support.messages.read'>): Promise<DurableCommit<Reply, OperationOutputFor<'support.messages.read'>>> {
    const response = await this.messages.readMessages(context.transaction, input, context);
    return { checkpoint: response, response };
  }
  finalize(input: OperationInputFor<'support.messages.read'>, checkpoint: Reply, context: FinalizeContext<'support.messages.read'>): Promise<Reply> {
    return this.messages.finalizeMessages(input, context, checkpoint);
  }
}
