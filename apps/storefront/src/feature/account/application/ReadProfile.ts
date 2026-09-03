import type { StorefrontSession } from '../../../entity/session';
import type { Profile } from '../model/Profile';
import { AccountGateway } from '../infrastructure/AccountGateway';
import { mapProfile } from '../infrastructure/AccountMapper';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';

export class ReadProfile {
  constructor(private readonly gateway: Pick<AccountGateway, 'profile'>) {}
  async execute(session: StorefrontSession, balances: BenefitBalances, signal?: AbortSignal): Promise<Profile> {
    return mapProfile(await this.gateway.profile(session, signal), balances);
  }
}
