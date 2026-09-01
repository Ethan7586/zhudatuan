import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VerifiedAfterSaleAttachment } from '../service/AfterSaleAttachmentService';

export interface AfterSaleRepository {
  read(context: ReadTransactionContext, input: OperationInputFor<'order.aftersales.read'>, execution: ExecutionContext<'order.aftersales.read'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.read'>>>;
  apply(
    context: WriteTransactionContext,
    input: OperationInputFor<'order.aftersales.apply'>,
    execution: ExecutionContext<'order.aftersales.apply'>,
    attachments: readonly VerifiedAfterSaleAttachment[]
  ): Promise<OperationReply<OperationOutputFor<'order.aftersales.apply'>>>;
  approve(context: WriteTransactionContext, input: OperationInputFor<'order.aftersales.approve'>, execution: ExecutionContext<'order.aftersales.approve'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.approve'>>>;
  reject(context: WriteTransactionContext, input: OperationInputFor<'order.aftersales.reject'>, execution: ExecutionContext<'order.aftersales.reject'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.reject'>>>;
}
