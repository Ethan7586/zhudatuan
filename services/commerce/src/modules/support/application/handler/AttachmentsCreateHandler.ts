import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AttachmentRepository, PreparedSupportOperation } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.attachments.create'>>;

export class AttachmentsCreateHandler implements DurableOperationHandler<'support.attachments.create', PreparedSupportOperation, Reply, 'write'> {
  readonly operation = 'support.attachments.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly attachments: AttachmentRepository) {}
  prepare(input: OperationInputFor<'support.attachments.create'>, context: PrepareContext<'support.attachments.create'>) {
    return this.attachments.prepareAttachment(input, context);
  }
  async commit(
    input: OperationInputFor<'support.attachments.create'>,
    prepared: PreparedSupportOperation,
    context: CommitContext<'support.attachments.create'>
  ): Promise<DurableCommit<Reply, OperationOutputFor<'support.attachments.create'>>> {
    const response = await this.attachments.createAttachment(context.transaction, input, context, prepared);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'support.attachments.create'>, checkpoint: Reply, _context: FinalizeContext<'support.attachments.create'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
