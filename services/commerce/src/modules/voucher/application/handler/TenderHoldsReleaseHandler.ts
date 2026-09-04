import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class TenderHoldsReleaseHandler implements OperationHandler<'voucher.tenderholds.release', 'write'> {
  readonly operation = 'voucher.tenderholds.release' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'tenderholdsRelease'>) {}
  execute(input: OperationInputFor<'voucher.tenderholds.release'>, context: WriteHandlerContext<'voucher.tenderholds.release'>): Promise<OperationReply<OperationOutputFor<'voucher.tenderholds.release'>>> {
    return this.application.tenderholdsRelease(input, context);
  }
}
