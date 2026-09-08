import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class VouchersUnbindHandler implements OperationHandler<'voucher.vouchers.unbind', 'write'> {
  readonly operation = 'voucher.vouchers.unbind' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'vouchersUnbind'>) {}
  execute(input: OperationInputFor<'voucher.vouchers.unbind'>, context: WriteHandlerContext<'voucher.vouchers.unbind'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.unbind'>>> {
    return this.application.vouchersUnbind(input, context);
  }
}
