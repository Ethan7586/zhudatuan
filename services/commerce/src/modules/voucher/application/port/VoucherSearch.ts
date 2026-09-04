import type { VoucherCall, VoucherReply } from './VoucherCall';
import type { SearchFilter } from './SearchFilter';
export interface VoucherSearch {
  read(call: VoucherCall<'voucher.search.read'>, filter: SearchFilter): VoucherReply<'voucher.search.read'>;
  facets(call: VoucherCall<'voucher.searchfacets.read'>, filter: SearchFilter): VoucherReply<'voucher.searchfacets.read'>;
  snapshot(call: VoucherCall<'voucher.searchsnapshots.create'>, filter: SearchFilter): VoucherReply<'voucher.searchsnapshots.create'>;
}
