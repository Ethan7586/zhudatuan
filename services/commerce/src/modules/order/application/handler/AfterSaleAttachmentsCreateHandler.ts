import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { AfterSaleAttachmentService, type PreparedAfterSaleAttachment } from '../service/AfterSaleAttachmentService';

type Reply = OperationReply<OperationOutputFor<'order.aftersaleattachments.create'>>;

export class AfterSaleAttachmentsCreateHandler implements DurableOperationHandler<'order.aftersaleattachments.create', PreparedAfterSaleAttachment, Reply, 'write'> {
  readonly operation = 'order.aftersaleattachments.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly attachments: AfterSaleAttachmentService) {}
  prepare(input: OperationInputFor<'order.aftersaleattachments.create'>, context: PrepareContext<'order.aftersaleattachments.create'>) {
    return this.attachments.authorize(input, requireSession(context.security).membership.id);
  }
  commit(_input: OperationInputFor<'order.aftersaleattachments.create'>, prepared: PreparedAfterSaleAttachment, _context: CommitContext<'order.aftersaleattachments.create'>): Promise<DurableCommit<Reply, OperationOutputFor<'order.aftersaleattachments.create'>>> {
    const response = Object.freeze({ status: 201 as const, body: { objectId: prepared.objectId, upload: prepared.upload } });
    return Promise.resolve({ checkpoint: response, response });
  }
  finalize(_input: OperationInputFor<'order.aftersaleattachments.create'>, checkpoint: Reply, _context: FinalizeContext<'order.aftersaleattachments.create'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
