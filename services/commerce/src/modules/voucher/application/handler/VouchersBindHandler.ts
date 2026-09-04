import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class VouchersBindHandler implements OperationHandler<'voucher.vouchers.bind', 'write'> {
  readonly operation = 'voucher.vouchers.bind' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'vouchersBind'>) {}
  execute(input: OperationInputFor<'voucher.vouchers.bind'>, context: WriteHandlerContext<'voucher.vouchers.bind'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.bind'>>> {
    return this.application.vouchersBind(input, context);
  }
}
