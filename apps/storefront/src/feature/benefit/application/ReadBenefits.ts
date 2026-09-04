import type { StorefrontSession } from '../../../entity/session';
import type { BenefitPort } from '../public/BenefitPort';
import type { BenefitAccount } from '../model/BenefitAccount';
export class ReadBenefits {
  constructor(private readonly gateway: Pick<BenefitPort, 'accounts'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> {
    return this.gateway.accounts(session, signal);
  }
}
