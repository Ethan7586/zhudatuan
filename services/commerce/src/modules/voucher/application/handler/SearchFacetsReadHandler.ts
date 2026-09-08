import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { VoucherApplication } from '../service/VoucherApplication';
import type { SearchFilter } from '../port/SearchFilter';
import { PreparedOperation } from '../service/PreparedOperation';

export class SearchFacetsReadHandler extends PreparedOperation<'voucher.searchfacets.read', SearchFilter, 'read'> {
  readonly operation = 'voucher.searchfacets.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareSearch' | 'searchfacetsRead'>) {
    super((input, context) => application.prepareSearch(input, context));
  }
  commit(input: OperationInputFor<'voucher.searchfacets.read'>, filter: SearchFilter, context: HandlerContext<'voucher.searchfacets.read'>) {
    return this.reply(this.application.searchfacetsRead(input, filter, context));
  }
}
