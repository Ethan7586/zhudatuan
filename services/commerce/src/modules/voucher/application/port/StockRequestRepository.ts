import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface StockRequestRepository {
  create(call: VoucherCall<'voucher.stockrequests.create'>): VoucherReply<'voucher.stockrequests.create'>;
  update(call: VoucherCall<'voucher.stockrequests.update'>): VoucherReply<'voucher.stockrequests.update'>;
  submit(call: VoucherCall<'voucher.stockrequests.submit'>): VoucherReply<'voucher.stockrequests.submit'>;
  cancel(call: VoucherCall<'voucher.stockrequests.cancel'>): VoucherReply<'voucher.stockrequests.cancel'>;
  get(call: VoucherCall<'voucher.stockrequests.get'>): VoucherReply<'voucher.stockrequests.get'>;
  list(call: VoucherCall<'voucher.stockrequests.list'>): VoucherReply<'voucher.stockrequests.list'>;
  options(call: VoucherCall<'voucher.stockrequestoptions.list'>): VoucherReply<'voucher.stockrequestoptions.list'>;
}
