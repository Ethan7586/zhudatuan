import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class RedemptionsGetHandler implements OperationHandler<'voucher.redemptions.get', 'read'> {
  readonly operation = 'voucher.redemptions.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'redemptionsGet'>) {}
  execute(input: OperationInputFor<'voucher.redemptions.get'>, context: HandlerContext<'voucher.redemptions.get'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.get'>>> {
    return this.application.redemptionsGet(input, context);
  }
}
