import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class RefundsCreateHandler implements OperationHandler<'voucher.refunds.create', 'write'> {
  readonly operation = 'voucher.refunds.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'refundsCreate'>) {}
  execute(input: OperationInputFor<'voucher.refunds.create'>, context: WriteHandlerContext<'voucher.refunds.create'>): Promise<OperationReply<OperationOutputFor<'voucher.refunds.create'>>> {
    return this.application.refundsCreate(input, context);
  }
}
