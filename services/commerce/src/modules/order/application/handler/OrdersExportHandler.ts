import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ExportRepository } from '../port/ExportRepository';

export class OrdersExportHandler implements OperationHandler<'order.orders.export', 'write'> {
  readonly operation = 'order.orders.export' as const;
  readonly mode = 'write' as const;
  constructor(private readonly exports: ExportRepository) {}
  execute(input: OperationInputFor<'order.orders.export'>, context: WriteHandlerContext<'order.orders.export'>): Promise<OperationReply<OperationOutputFor<'order.orders.export'>>> {
    const transaction = context.transaction;
    return this.exports.create(transaction, input, context);
  }
}
