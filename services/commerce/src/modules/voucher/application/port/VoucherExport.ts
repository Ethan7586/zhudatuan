import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface VoucherExport {
  search(call: VoucherCall<'voucher.searchexports.create'>): VoucherReply<'voucher.searchexports.create'>;
}
