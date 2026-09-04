import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ActionBatchesCreateHandler implements OperationHandler<'voucher.actionbatches.create', 'write'> {
  readonly operation = 'voucher.actionbatches.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'actionbatchesCreate'>) {}
  execute(input: OperationInputFor<'voucher.actionbatches.create'>, context: WriteHandlerContext<'voucher.actionbatches.create'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.create'>>> {
    return this.application.actionbatchesCreate(input, context);
  }
}
