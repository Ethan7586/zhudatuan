import type { VoucherOperations } from '@shop/sdk/voucher';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { Redemption } from '../model/Redemption';
import type { Voucher } from '../model/Voucher';
import { mapVoucherCenter } from './VoucherMapper';
import type { VoucherPort } from '../public/VoucherPort';

export class VoucherGateway implements VoucherPort {
  constructor(
    private readonly voucher: VoucherOperations,
    private readonly context: RequestContextFactory
  ) {}
  async vouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
    const value = await this.voucher.bindingsRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapVoucherCenter(value.items, []).vouchers;
  }
  async redemptions(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> {
    const value = await this.voucher.redemptionsRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapVoucherCenter([], value.items).redemptions;
  }
}
