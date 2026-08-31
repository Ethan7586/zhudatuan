import type { StorefrontSession } from '../../../shared/api/Session';
import type { Profile } from '../model/Profile';
import { AccountGateway } from '../infrastructure/AccountGateway';
import { mapProfile } from '../infrastructure/AccountMapper';
import type { BenefitBalances } from '../../benefit/public/BenefitReader';

export class ReadProfile {
  async execute(session: StorefrontSession, balances: BenefitBalances, signal?: AbortSignal): Promise<Profile> {
    return mapProfile(await AccountGateway.profile(session, signal), balances);
  }
}
