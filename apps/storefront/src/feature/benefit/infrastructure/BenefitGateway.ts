import type { BenefitOperations } from '@shop/sdk/benefit';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { BenefitAccount } from '../model/BenefitAccount';
import type { BenefitEntry } from '../model/BenefitEntry';
import { mapBenefitCenter } from './BenefitMapper';
import type { BenefitPort } from '../public/BenefitPort';
import { readCursorPages } from '../../../shared/api/CursorPage';

export class BenefitGateway implements BenefitPort {
  constructor(
    private readonly benefit: BenefitOperations,
    private readonly context: RequestContextFactory
  ) {}
  async accounts(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> {
    const pages = await readCursorPages(
      (cursor) => this.benefit.accountsRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal })),
      signal
    );
    return mapBenefitCenter(pages.flatMap(({ items }) => items), []).accounts;
  }
  async ledger(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> {
    const pages = await readCursorPages(
      (cursor) => this.benefit.ledgersRead({ query: { limit: 100, ...(cursor ? { cursor } : {}) } }, this.context(session, { signal })),
      signal
    );
    return mapBenefitCenter([], pages.flatMap(({ items }) => items)).ledger;
  }
}
