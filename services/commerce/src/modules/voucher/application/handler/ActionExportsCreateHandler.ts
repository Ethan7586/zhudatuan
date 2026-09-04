import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ActionExportsCreateHandler implements OperationHandler<'voucher.actionexports.create', 'write'> {
  readonly operation = 'voucher.actionexports.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'actionexportsCreate'>) {}
  execute(input: OperationInputFor<'voucher.actionexports.create'>, context: WriteHandlerContext<'voucher.actionexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.actionexports.create'>>> {
    return this.application.actionexportsCreate(input, context);
  }
}
