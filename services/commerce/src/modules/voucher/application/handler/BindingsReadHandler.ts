import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { VoucherRepository } from '../port/VoucherRepository';

export class BindingsReadHandler implements OperationHandler<'voucher.bindings.read', 'read'> {
  readonly operation = 'voucher.bindings.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly vouchers: VoucherRepository) {}
  async execute(input: OperationInputFor<'voucher.bindings.read'>, context: HandlerContext<'voucher.bindings.read'>) {
    const result = await this.vouchers.readBindings(context.transaction, input, context);
    return result;
  }
}
