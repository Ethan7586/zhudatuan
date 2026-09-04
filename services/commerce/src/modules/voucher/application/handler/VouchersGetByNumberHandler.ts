import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { VoucherApplication } from '../service/VoucherApplication';
import { PreparedOperation } from '../service/PreparedOperation';

export class VouchersGetByNumberHandler extends PreparedOperation<'voucher.vouchers.getbynumber', string, 'read'> {
  readonly operation = 'voucher.vouchers.getbynumber' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareVoucherNumber' | 'vouchersGetbynumber'>) {
    super((input, context) => application.prepareVoucherNumber(input, context));
  }
  commit(input: OperationInputFor<'voucher.vouchers.getbynumber'>, fingerprint: string, context: HandlerContext<'voucher.vouchers.getbynumber'>) {
    return this.reply(this.application.vouchersGetbynumber(input, fingerprint, context));
  }
}
