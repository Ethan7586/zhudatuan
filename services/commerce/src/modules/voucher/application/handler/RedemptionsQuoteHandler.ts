import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class RedemptionsQuoteHandler implements OperationHandler<'voucher.redemptions.quote', 'read'> {
  readonly operation = 'voucher.redemptions.quote' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'redemptionsQuote'>) {}
  execute(input: OperationInputFor<'voucher.redemptions.quote'>, context: HandlerContext<'voucher.redemptions.quote'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.quote'>>> {
    return this.application.redemptionsQuote(input, context);
  }
}
