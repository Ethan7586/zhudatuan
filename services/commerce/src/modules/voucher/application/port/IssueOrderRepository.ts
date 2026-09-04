import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface IssueOrderRepository {
  create(call: VoucherCall<'voucher.issueorders.create'>): VoucherReply<'voucher.issueorders.create'>;
  update(call: VoucherCall<'voucher.issueorders.update'>): VoucherReply<'voucher.issueorders.update'>;
  submit(call: VoucherCall<'voucher.issueorders.submit'>): VoucherReply<'voucher.issueorders.submit'>;
  cancel(call: VoucherCall<'voucher.issueorders.cancel'>): VoucherReply<'voucher.issueorders.cancel'>;
  get(call: VoucherCall<'voucher.issueorders.get'>): VoucherReply<'voucher.issueorders.get'>;
  list(call: VoucherCall<'voucher.issueorders.list'>): VoucherReply<'voucher.issueorders.list'>;
  retry(call: VoucherCall<'voucher.issuebatches.retry'>): VoucherReply<'voucher.issuebatches.retry'>;
  batch(call: VoucherCall<'voucher.issuebatches.get'>): VoucherReply<'voucher.issuebatches.get'>;
  export(call: VoucherCall<'voucher.issueorderexports.create'>): VoucherReply<'voucher.issueorderexports.create'>;
}
