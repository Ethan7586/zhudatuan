import type { StorefrontSession } from '../../../entity/session';
import type { Redemption } from '../model/Redemption';
import type { Voucher } from '../model/Voucher';

export interface VoucherPort {
  vouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]>;
  redemptions(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]>;
}
