import type { StorefrontSession } from '../../../entity/session';
import type { VoucherActivity } from '../model/VoucherActivity';
import type { Voucher } from '../model/Voucher';
import type { VoucherPage } from '../model/VoucherPage';
import type { Activation } from '../model/Activation';

export interface VoucherPort {
  activate(session: StorefrontSession, input: Activation, key: string, signal: AbortSignal): Promise<Voucher>;
  list(session: StorefrontSession, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<Voucher>>;
  detail(session: StorefrontSession, voucher: string, signal?: AbortSignal): Promise<Voucher>;
  timeline(session: StorefrontSession, voucher: string, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<VoucherActivity>>;
}
