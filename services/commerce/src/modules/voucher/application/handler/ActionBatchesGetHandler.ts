import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ActionBatchesGetHandler implements OperationHandler<'voucher.actionbatches.get', 'read'> {
  readonly operation = 'voucher.actionbatches.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'actionbatchesGet'>) {}
  execute(input: OperationInputFor<'voucher.actionbatches.get'>, context: HandlerContext<'voucher.actionbatches.get'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.get'>>> {
    return this.application.actionbatchesGet(input, context);
  }
}
