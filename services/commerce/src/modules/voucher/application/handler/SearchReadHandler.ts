import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { VoucherApplication } from '../service/VoucherApplication';
import type { SearchFilter } from '../port/SearchFilter';
import { PreparedOperation } from '../service/PreparedOperation';

export class SearchReadHandler extends PreparedOperation<'voucher.search.read', SearchFilter, 'read'> {
  readonly operation = 'voucher.search.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareSearch' | 'searchRead'>) {
    super((input, context) => application.prepareSearch(input, context));
  }
  commit(input: OperationInputFor<'voucher.search.read'>, filter: SearchFilter, context: HandlerContext<'voucher.search.read'>) {
    return this.reply(this.application.searchRead(input, filter, context));
  }
}
