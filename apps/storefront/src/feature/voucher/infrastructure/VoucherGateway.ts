import type { VoucherOperations } from '@shop/sdk/voucher';
import type { StorefrontSession } from '../../../entity/session';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { VoucherActivity } from '../model/VoucherActivity';
import type { Voucher } from '../model/Voucher';
import type { VoucherPage } from '../model/VoucherPage';
import type { VoucherPort } from '../public/VoucherPort';
import { mapActivity, mapVoucher } from './VoucherMapper';
import type { Activation } from '../model/Activation';

export class VoucherGateway implements VoucherPort {
  constructor(
    private readonly voucher: VoucherOperations,
    private readonly context: RequestContextFactory
  ) {}

  async activate(session: StorefrontSession, input: Activation, key: string, signal: AbortSignal): Promise<Voucher> {
    const context = this.context(session, { write: true, idempotencyKey: key, signal });
    const value = input.mode === 'numbersecret'
      ? await this.voucher.activationsNumbersecret({ body: { number: input.number, secret: input.secret } }, context)
      : await this.voucher.activationsSecret({ body: { secret: input.secret } }, context);
    return mapVoucher(value);
  }

  async list(session: StorefrontSession, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<Voucher>> {
    const value = await this.voucher.searchRead({ query: { limit: 20, ...(cursor ? { cursor } : {}) } }, this.context(session, signal ? { signal } : {}));
    return Object.freeze({ items: Object.freeze(value.items.map(mapVoucher)), nextCursor: value.nextCursor ?? null });
  }

  async detail(session: StorefrontSession, voucher: string, signal?: AbortSignal): Promise<Voucher> {
    const value = await this.voucher.vouchersGet({ path: { voucherid: voucher } }, this.context(session, signal ? { signal } : {}));
    return mapVoucher(value);
  }

  async timeline(session: StorefrontSession, voucher: string, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<VoucherActivity>> {
    const value = await this.voucher.vouchersTimeline({ path: { voucherid: voucher }, query: { limit: 20, ...(cursor ? { cursor } : {}) } }, this.context(session, signal ? { signal } : {}));
    return Object.freeze({ items: Object.freeze(value.items.map(mapActivity)), nextCursor: value.nextCursor ?? null });
  }
}
