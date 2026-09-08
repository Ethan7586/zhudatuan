import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class VouchersGetHandler implements OperationHandler<'voucher.vouchers.get', 'read'> {
  readonly operation = 'voucher.vouchers.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'vouchersGet'>) {}
  execute(input: OperationInputFor<'voucher.vouchers.get'>, context: HandlerContext<'voucher.vouchers.get'>): Promise<OperationReply<OperationOutputFor<'voucher.vouchers.get'>>> {
    return this.application.vouchersGet(input, context);
  }
}
