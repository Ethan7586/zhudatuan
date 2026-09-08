import type { ReferralOperations } from '@shop/sdk/referral';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { ReferralPort } from '../public/ReferralPort';

export class ReferralGateway implements ReferralPort {
  constructor(
    private readonly referral: ReferralOperations,
    private readonly context: RequestContextFactory
  ) {}
  bind(session: StorefrontSession, token: string): Promise<unknown> {
    return this.referral.bindingsCreate({ body: { token, source: 'storefront' } }, this.context(session, { write: true, idempotencyKey: `referral:binding:${crypto.randomUUID()}` }));
  }
  apply(session: StorefrontSession, input: Readonly<{ displayName: string; mobile: string; reason: string }>, idempotencyKey: string) {
    return this.referral.membersApply({ body: input }, this.context(session, { write: true, idempotencyKey }));
  }
  earnings(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    return this.referral.earningsRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal }));
  }
  async link(session: StorefrontSession, productId?: string, signal?: AbortSignal) {
    return this.referral.linksRead({ query: productId ? { productId } : {} }, this.context(session, { signal }));
  }
  async withdrawals(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    const value = await this.referral.withdrawalsRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal }));
    return Object.freeze({ items: Object.freeze(value.items.map((item) => Object.freeze(item))), nextCursor: value.nextCursor ?? null });
  }
  async withdraw(session: StorefrontSession, input: Readonly<{ amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>, idempotencyKey: string) {
    const { expectedVersion, ...body } = input;
    return this.referral.withdrawalsCreate({ body: { ...body, expectedVersion } }, this.context(session, { write: true, expectedVersion, idempotencyKey }));
  }
}
