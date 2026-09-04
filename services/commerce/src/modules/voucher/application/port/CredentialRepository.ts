import type { VoucherCall, VoucherReply } from './VoucherCall';
export interface CredentialRepository {
  generate(call: VoucherCall<'voucher.credentials.generate'>): VoucherReply<'voucher.credentials.generate'>;
  import(call: VoucherCall<'voucher.credentials.import'>): VoucherReply<'voucher.credentials.import'>;
  list(call: VoucherCall<'voucher.credentials.list'>): VoucherReply<'voucher.credentials.list'>;
  get(call: VoucherCall<'voucher.credentials.get'>): VoucherReply<'voucher.credentials.get'>;
  export(call: VoucherCall<'voucher.credentialexports.create'>): VoucherReply<'voucher.credentialexports.create'>;
  job(call: VoucherCall<'voucher.jobs.get'>): VoucherReply<'voucher.jobs.get'>;
}
