import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueBatchesGetHandler implements OperationHandler<'voucher.issuebatches.get', 'read'> {
  readonly operation = 'voucher.issuebatches.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issuebatchesGet'>) {}
  execute(input: OperationInputFor<'voucher.issuebatches.get'>, context: HandlerContext<'voucher.issuebatches.get'>): Promise<OperationReply<OperationOutputFor<'voucher.issuebatches.get'>>> {
    return this.application.issuebatchesGet(input, context);
  }
}
