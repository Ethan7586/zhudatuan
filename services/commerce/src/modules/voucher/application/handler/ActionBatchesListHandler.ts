import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ActionBatchesListHandler implements OperationHandler<'voucher.actionbatches.list', 'read'> {
  readonly operation = 'voucher.actionbatches.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'actionbatchesList'>) {}
  execute(input: OperationInputFor<'voucher.actionbatches.list'>, context: HandlerContext<'voucher.actionbatches.list'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.list'>>> {
    return this.application.actionbatchesList(input, context);
  }
}
