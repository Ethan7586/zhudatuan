import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { VoucherRepository } from '../port/VoucherRepository';

export class RedemptionsReverseHandler implements OperationHandler<'voucher.redemptions.reverse', 'write'> {
  readonly operation = 'voucher.redemptions.reverse' as const;
  readonly mode = 'write' as const;
  constructor(private readonly vouchers: VoucherRepository) {}
  async execute(input: OperationInputFor<'voucher.redemptions.reverse'>, context: WriteHandlerContext<'voucher.redemptions.reverse'>) {
    const result = await this.vouchers.reverseRedemption(context.transaction, input, context);
    return result;
  }
}
