import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { VoucherRepository } from '../port/VoucherRepository';

export class HistoryReadHandler implements OperationHandler<'voucher.history.read', 'read'> {
  readonly operation = 'voucher.history.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly vouchers: VoucherRepository) {}
  async execute(input: OperationInputFor<'voucher.history.read'>, context: HandlerContext<'voucher.history.read'>) {
    const result = await this.vouchers.readHistory(context.transaction, input, context);
    return result;
  }
}
