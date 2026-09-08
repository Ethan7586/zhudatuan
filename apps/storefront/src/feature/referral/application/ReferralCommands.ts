import type { StorefrontSession } from '../../../entity/session';
import type { ReferralPort } from '../public/ReferralPort';

export class ReferralCommands {
  constructor(private readonly gateway: Pick<ReferralPort, 'apply' | 'withdraw'>) {}
  apply(session: StorefrontSession, input: Readonly<{ displayName: string; mobile: string; reason: string }>, idempotencyKey = crypto.randomUUID()) {
    return this.gateway.apply(session, input, idempotencyKey);
  }
  withdraw(session: StorefrontSession, input: Readonly<{ amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>, idempotencyKey = crypto.randomUUID()) {
    return this.gateway.withdraw(session, input, idempotencyKey);
  }
}
