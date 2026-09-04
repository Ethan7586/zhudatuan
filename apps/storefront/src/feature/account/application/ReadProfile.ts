import type { StorefrontSession } from '../../../entity/session';
import type { Profile } from '../model/Profile';
import type { AccountPort } from '../public/AccountPort';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';

export class ReadProfile {
  constructor(private readonly gateway: Pick<AccountPort, 'profile'>) {}
  async execute(session: StorefrontSession, balances: BenefitBalances, signal?: AbortSignal): Promise<Profile> {
    return this.gateway.profile(session, balances, signal);
  }
}
