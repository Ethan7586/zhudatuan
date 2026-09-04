import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class SearchExportsCreateHandler implements OperationHandler<'voucher.searchexports.create', 'write'> {
  readonly operation = 'voucher.searchexports.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'searchexportsCreate'>) {}
  execute(input: OperationInputFor<'voucher.searchexports.create'>, context: WriteHandlerContext<'voucher.searchexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.searchexports.create'>>> {
    return this.application.searchexportsCreate(input, context);
  }
}
