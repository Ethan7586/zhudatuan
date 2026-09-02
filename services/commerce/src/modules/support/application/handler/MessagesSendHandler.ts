import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { MessageSender, PreparedSupportOperation } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.messages.send'>>;

export class MessagesSendHandler implements DurableOperationHandler<'support.messages.send', PreparedSupportOperation, Reply, 'write', PreparedSupportOperation> {
  readonly operation = 'support.messages.send' as const;
  readonly mode = 'write' as const;
  constructor(private readonly messages: MessageSender) {}
  load(input: OperationInputFor<'support.messages.send'>, context: HandlerContext<'support.messages.send'>) {
    return this.messages.loadMessage(context.transaction, input, context);
  }
  prepare(input: OperationInputFor<'support.messages.send'>, context: PrepareContext<'support.messages.send'>, loaded: PreparedSupportOperation) {
    return this.messages.prepareMessage(input, context, loaded);
  }
  async commit(input: OperationInputFor<'support.messages.send'>, prepared: PreparedSupportOperation, context: CommitContext<'support.messages.send'>): Promise<DurableCommit<Reply, OperationOutputFor<'support.messages.send'>>> {
    const response = await this.messages.sendMessage(context.transaction, input, context, prepared);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'support.messages.send'>, checkpoint: Reply, _context: FinalizeContext<'support.messages.send'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
  idempotencyResponse(response: Reply): Reply {
    return Object.freeze({ ...response, body: Object.freeze({ ...response.body, message: Object.freeze({ ...response.body.message, body: '' }) }) });
  }
}
