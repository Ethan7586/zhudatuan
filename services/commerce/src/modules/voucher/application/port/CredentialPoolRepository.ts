import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface CredentialPoolRepository {
  create(call: VoucherCall<'voucher.credentialpools.create'>): VoucherReply<'voucher.credentialpools.create'>;
  close(call: VoucherCall<'voucher.credentialpools.close'>): VoucherReply<'voucher.credentialpools.close'>;
  get(call: VoucherCall<'voucher.credentialpools.get'>): VoucherReply<'voucher.credentialpools.get'>;
  list(call: VoucherCall<'voucher.credentialpools.list'>): VoucherReply<'voucher.credentialpools.list'>;
}
