import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class TenderHoldsConsumeHandler implements OperationHandler<'voucher.tenderholds.consume', 'write'> {
  readonly operation = 'voucher.tenderholds.consume' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'tenderholdsConsume'>) {}
  execute(input: OperationInputFor<'voucher.tenderholds.consume'>, context: WriteHandlerContext<'voucher.tenderholds.consume'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.consume'>>> {
    return this.application.tenderholdsConsume(input, context);
  }
}
