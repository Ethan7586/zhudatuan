import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface TenderRepository {
  create(call: VoucherCall<'voucher.tenderholds.create'>): VoucherReply<'voucher.tenderholds.create'>;
  consume(call: VoucherCall<'voucher.tenderholds.consume'>): VoucherReply<'voucher.tenderholds.consume'>;
  release(call: VoucherCall<'voucher.tenderholds.release'>): VoucherReply<'voucher.tenderholds.release'>;
}
