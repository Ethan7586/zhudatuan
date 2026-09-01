import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { VoucherRepository } from '../port/VoucherRepository';

export class BindingsManageHandler implements OperationHandler<'voucher.bindings.manage', 'write'> {
  readonly operation = 'voucher.bindings.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly vouchers: VoucherRepository) {}
  async execute(input: OperationInputFor<'voucher.bindings.manage'>, context: WriteHandlerContext<'voucher.bindings.manage'>) {
    const result = await this.vouchers.manageBinding(context.transaction, input, context);
    return result;
  }
}
