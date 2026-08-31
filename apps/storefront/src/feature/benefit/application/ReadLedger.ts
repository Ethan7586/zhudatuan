import type { StorefrontSession } from '../../../shared/api/Session';
import { BenefitGateway } from '../infrastructure/BenefitGateway';
import type { BenefitEntry } from '../model/BenefitEntry';
export function readLedger(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> {
  return BenefitGateway.ledger(session, signal);
}
