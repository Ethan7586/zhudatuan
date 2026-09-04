import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class TenderHoldsCreateHandler implements OperationHandler<'voucher.tenderholds.create', 'write'> {
  readonly operation = 'voucher.tenderholds.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'tenderholdsCreate'>) {}
  execute(input: OperationInputFor<'voucher.tenderholds.create'>, context: WriteHandlerContext<'voucher.tenderholds.create'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.create'>>> {
    return this.application.tenderholdsCreate(input, context);
  }
}
