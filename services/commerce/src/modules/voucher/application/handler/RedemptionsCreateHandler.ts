import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class RedemptionsCreateHandler implements OperationHandler<'voucher.redemptions.create', 'write'> {
  readonly operation = 'voucher.redemptions.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'redemptionsCreate'>) {}
  execute(input: OperationInputFor<'voucher.redemptions.create'>, context: WriteHandlerContext<'voucher.redemptions.create'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.create'>>> {
    return this.application.redemptionsCreate(input, context);
  }
}
