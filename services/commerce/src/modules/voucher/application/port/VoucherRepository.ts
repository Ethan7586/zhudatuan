import type { VoucherCall, VoucherReply } from './VoucherCall';
import type { ActivationLookup } from './ActivationRate';
export interface VoucherRepository {
  activateSecret(call: VoucherCall<'voucher.activations.secret'>, lookup: ActivationLookup): VoucherReply<'voucher.activations.secret'>;
  activateNumber(call: VoucherCall<'voucher.activations.numbersecret'>, lookup: ActivationLookup): VoucherReply<'voucher.activations.numbersecret'>;
  bind(call: VoucherCall<'voucher.vouchers.bind'>): VoucherReply<'voucher.vouchers.bind'>;
  unbind(call: VoucherCall<'voucher.vouchers.unbind'>): VoucherReply<'voucher.vouchers.unbind'>;
  get(call: VoucherCall<'voucher.vouchers.get'>): VoucherReply<'voucher.vouchers.get'>;
  number(call: VoucherCall<'voucher.vouchers.getbynumber'>, fingerprint: string): VoucherReply<'voucher.vouchers.getbynumber'>;
  timeline(call: VoucherCall<'voucher.vouchers.timeline'>): VoucherReply<'voucher.vouchers.timeline'>;
  quote(call: VoucherCall<'voucher.redemptions.quote'>): VoucherReply<'voucher.redemptions.quote'>;
  redeem(call: VoucherCall<'voucher.redemptions.create'>): VoucherReply<'voucher.redemptions.create'>;
  refund(call: VoucherCall<'voucher.refunds.create'>): VoucherReply<'voucher.refunds.create'>;
  redemption(call: VoucherCall<'voucher.redemptions.get'>): VoucherReply<'voucher.redemptions.get'>;
}
