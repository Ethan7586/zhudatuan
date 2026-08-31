import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { Redemption } from '../model/Redemption';
import type { Voucher } from '../model/Voucher';
import { mapVoucherCenter } from './VoucherMapper';

export const VoucherGateway = Object.freeze({
  async vouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
    const value = await storefrontClient.commerce.voucher.bindingsRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapVoucherCenter(value.items, []).vouchers;
  },
  async redemptions(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> {
    const value = await storefrontClient.commerce.voucher.redemptionsRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapVoucherCenter([], value.items).redemptions;
  },
});
