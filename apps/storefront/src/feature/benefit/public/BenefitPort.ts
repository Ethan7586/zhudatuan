import type { StorefrontSession } from '../../../entity/session';
import type { BenefitAccount } from '../model/BenefitAccount';
import type { BenefitEntry } from '../model/BenefitEntry';

export interface BenefitPort {
  accounts(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]>;
  ledger(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]>;
}
