import type { StorefrontSession } from '../../../entity/session';
import type { BenefitAccount } from '../model/BenefitAccount';

export interface BenefitReader {
  accounts(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]>;
}

export interface BenefitBalances {
  readonly welfareMinor: number;
  readonly mealMinor: number;
}

export function benefitBalances(accounts: readonly BenefitAccount[]): BenefitBalances {
  return accounts
    .filter(({ status }) => status === 'active')
    .reduce<BenefitBalances>(
      (balances, account) => (account.kind === 'meal' ? { ...balances, mealMinor: balances.mealMinor + account.availableMinor } : { ...balances, welfareMinor: balances.welfareMinor + account.availableMinor }),
      Object.freeze({ welfareMinor: 0, mealMinor: 0 })
    );
}
