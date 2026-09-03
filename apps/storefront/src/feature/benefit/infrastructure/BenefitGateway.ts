import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { BenefitAccount } from '../model/BenefitAccount';
import type { BenefitEntry } from '../model/BenefitEntry';
import { mapBenefitCenter } from './BenefitMapper';

export class BenefitGateway {
  constructor(private readonly benefit: StorefrontClient['commerce']['benefit'], private readonly context: StorefrontClient['context']) {}
  async accounts(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> {
    const value = await this.benefit.accountsRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapBenefitCenter(value.items, []).accounts;
  }
  async ledger(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> {
    const value = await this.benefit.ledgersRead({ query: { limit: 100 } }, this.context(session, { signal }));
    return mapBenefitCenter([], value.items).ledger;
  }
}
