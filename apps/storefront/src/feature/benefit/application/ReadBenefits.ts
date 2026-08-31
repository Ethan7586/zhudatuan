import type { StorefrontSession } from '../../../shared/api/Session';
import { BenefitGateway } from '../infrastructure/BenefitGateway';
import type { BenefitAccount } from '../model/BenefitAccount';
export function readBenefits(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitAccount[]> {
  return BenefitGateway.accounts(session, signal);
}
