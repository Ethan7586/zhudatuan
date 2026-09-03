import type { StorefrontSession } from '../../../entity/session';
import { BenefitGateway } from '../infrastructure/BenefitGateway';
import type { BenefitAccount } from '../model/BenefitAccount';
export class ReadBenefits {
  constructor(private readonly gateway: Pick<BenefitGateway, 'accounts'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> { return this.gateway.accounts(session, signal); }
}
