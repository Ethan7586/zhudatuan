import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { Redemption } from '../model/Redemption';
import type { Voucher } from '../model/Voucher';
import { mapVoucherCenter } from './VoucherMapper';

export class VoucherGateway {
  constructor(private readonly voucher: StorefrontClient['commerce']['voucher'], private readonly context: StorefrontClient['context']) {}
  async vouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
    const value = await this.voucher.bindingsRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapVoucherCenter(value.items, []).vouchers;
  }
  async redemptions(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> {
    const value = await this.voucher.redemptionsRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapVoucherCenter([], value.items).redemptions;
  }
}
