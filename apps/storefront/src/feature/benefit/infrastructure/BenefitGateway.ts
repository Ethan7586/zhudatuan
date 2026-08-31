import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { BenefitAccount } from '../model/BenefitAccount';
import type { BenefitEntry } from '../model/BenefitEntry';
import { mapBenefitCenter } from './BenefitMapper';

export const BenefitGateway = Object.freeze({
  async accounts(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> {
    const value = await storefrontClient.commerce.benefit.accountsRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapBenefitCenter(value.items, []).accounts;
  },
  async ledger(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> {
    const value = await storefrontClient.commerce.benefit.ledgersRead({ query: { limit: 100 } }, storefrontClient.context(session, { signal }));
    return mapBenefitCenter([], value.items).ledger;
  },
});
