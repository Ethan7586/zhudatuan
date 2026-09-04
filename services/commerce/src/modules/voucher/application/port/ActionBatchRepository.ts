import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface ActionBatchRepository {
  create(call: VoucherCall<'voucher.actionbatches.create'>): VoucherReply<'voucher.actionbatches.create'>;
  get(call: VoucherCall<'voucher.actionbatches.get'>): VoucherReply<'voucher.actionbatches.get'>;
  list(call: VoucherCall<'voucher.actionbatches.list'>): VoucherReply<'voucher.actionbatches.list'>;
  retry(call: VoucherCall<'voucher.actionbatches.retry'>): VoucherReply<'voucher.actionbatches.retry'>;
  export(call: VoucherCall<'voucher.actionexports.create'>): VoucherReply<'voucher.actionexports.create'>;
}
