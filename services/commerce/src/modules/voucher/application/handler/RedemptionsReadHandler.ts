import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { VoucherRepository } from '../port/VoucherRepository';

export class RedemptionsReadHandler implements OperationHandler<'voucher.redemptions.read', 'read'> {
  readonly operation = 'voucher.redemptions.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly vouchers: VoucherRepository) {}
  async execute(input: OperationInputFor<'voucher.redemptions.read'>, context: HandlerContext<'voucher.redemptions.read'>) {
    const result = await this.vouchers.readRedemptions(context.transaction, input, context);
    return result;
  }
}
