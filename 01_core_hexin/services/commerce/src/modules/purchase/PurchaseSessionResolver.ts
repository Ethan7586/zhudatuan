import type { AuthenticatedActor } from '../../foundation/security/AccessContext';
import type { SessionResolver } from '../../foundation/security/SessionResolver';
import { assertPurchaseTarget } from './PurchasePolicy';

/** Reject a non-storefront credential immediately after session resolution. */
export class PurchaseSessionResolver implements SessionResolver {
  constructor(private readonly delegate: SessionResolver) {}

  async resolve(headers: Readonly<Record<string, string>>): Promise<AuthenticatedActor> {
    const actor = await this.delegate.resolve(headers);
    assertPurchaseTarget(actor.target);
    return actor;
  }
}
