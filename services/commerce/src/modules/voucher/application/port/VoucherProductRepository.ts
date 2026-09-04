import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface VoucherProductRepository {
  create(call: VoucherCall<'voucher.products.create'>): VoucherReply<'voucher.products.create'>;
  revise(call: VoucherCall<'voucher.products.revise'>): VoucherReply<'voucher.products.revise'>;
  enable(call: VoucherCall<'voucher.products.enable'>): VoucherReply<'voucher.products.enable'>;
  disable(call: VoucherCall<'voucher.products.disable'>): VoucherReply<'voucher.products.disable'>;
  get(call: VoucherCall<'voucher.products.get'>): VoucherReply<'voucher.products.get'>;
  list(call: VoucherCall<'voucher.products.list'>): VoucherReply<'voucher.products.list'>;
  options(call: VoucherCall<'voucher.productoptions.list'>): VoucherReply<'voucher.productoptions.list'>;
}
