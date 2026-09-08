import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AfterSaleRepository } from '../port/AfterSaleRepository';
import { AfterSaleAttachment, type VerifiedAfterSaleAttachment } from '../service/AfterSaleAttachment';

type Reply = OperationReply<OperationOutputFor<'order.aftersales.apply'>>;

export class AfterSalesApplyHandler implements DurableOperationHandler<'order.aftersales.apply', readonly VerifiedAfterSaleAttachment[], Reply, 'write'> {
  readonly operation = 'order.aftersales.apply' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly afterSales: AfterSaleRepository,
    private readonly attachments: AfterSaleAttachment
  ) {}
  prepare(input: OperationInputFor<'order.aftersales.apply'>, context: PrepareContext<'order.aftersales.apply'>): Promise<readonly VerifiedAfterSaleAttachment[]> {
    return this.attachments.verify(input, requireSession(context.security).membership.id);
  }
  async commit(input: OperationInputFor<'order.aftersales.apply'>, attachments: readonly VerifiedAfterSaleAttachment[], context: CommitContext<'order.aftersales.apply'>) {
    const response = await this.afterSales.apply(context.transaction, input, context, attachments);
    return Object.freeze({ checkpoint: response, response });
  }
  async finalize(_input: OperationInputFor<'order.aftersales.apply'>, checkpoint: Reply, _context: FinalizeContext<'order.aftersales.apply'>): Promise<Reply> {
    return checkpoint;
  }
}
