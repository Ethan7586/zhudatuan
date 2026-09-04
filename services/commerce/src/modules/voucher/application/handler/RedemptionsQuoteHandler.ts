import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class RedemptionsQuoteHandler implements OperationHandler<'voucher.redemptions.quote', 'write'> {
  readonly operation = 'voucher.redemptions.quote' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'redemptionsQuote'>) {}
  execute(input: OperationInputFor<'voucher.redemptions.quote'>, context: WriteHandlerContext<'voucher.redemptions.quote'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.quote'>>> {
    return this.application.redemptionsQuote(input, context);
  }
}
