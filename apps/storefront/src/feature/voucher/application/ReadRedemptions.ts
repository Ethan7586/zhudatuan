import type { StorefrontSession } from '../../../shared/api/Session';
import { VoucherGateway } from '../infrastructure/VoucherGateway';
import type { Redemption } from '../model/Redemption';

export function readRedemptions(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> {
  return VoucherGateway.redemptions(session, signal);
}
