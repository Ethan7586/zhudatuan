import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { MessageRepository, PreparedSupportOperation } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.messages.send'>>;

export class MessagesSendHandler implements DurableOperationHandler<'support.messages.send', PreparedSupportOperation, Reply, 'write'> {
  readonly operation = 'support.messages.send' as const;
  readonly mode = 'write' as const;
  constructor(private readonly messages: MessageRepository) {}
  prepare(input: OperationInputFor<'support.messages.send'>, context: PrepareContext<'support.messages.send'>) {
    return this.messages.prepareMessage(input, context);
  }
  async commit(input: OperationInputFor<'support.messages.send'>, prepared: PreparedSupportOperation, context: CommitContext<'support.messages.send'>): Promise<DurableCommit<Reply, OperationOutputFor<'support.messages.send'>>> {
    const response = await this.messages.sendMessage(context.transaction, input, context, prepared);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'support.messages.send'>, checkpoint: Reply, _context: FinalizeContext<'support.messages.send'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
