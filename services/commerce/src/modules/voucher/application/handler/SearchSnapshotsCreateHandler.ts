import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { VoucherApplication } from '../service/VoucherApplication';
import type { SearchFilter } from '../port/SearchFilter';
import { PreparedOperation } from '../service/PreparedOperation';

export class SearchSnapshotsCreateHandler extends PreparedOperation<'voucher.searchsnapshots.create', SearchFilter, 'write'> {
  readonly operation = 'voucher.searchsnapshots.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareSearch' | 'searchsnapshotsCreate'>) {
    super((input, context) => application.prepareSearch(input, context));
  }
  commit(input: OperationInputFor<'voucher.searchsnapshots.create'>, filter: SearchFilter, context: WriteHandlerContext<'voucher.searchsnapshots.create'>) {
    return this.reply(this.application.searchsnapshotsCreate(input, filter, context));
  }
}
