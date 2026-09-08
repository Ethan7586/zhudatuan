import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class VouchersTimelineHandler implements OperationHandler<'voucher.vouchers.timeline', 'read'> {
  readonly operation = 'voucher.vouchers.timeline' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'vouchersTimeline'>) {}
  execute(input: OperationInputFor<'voucher.vouchers.timeline'>, context: HandlerContext<'voucher.vouchers.timeline'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.timeline'>>> {
    return this.application.vouchersTimeline(input, context);
  }
}
