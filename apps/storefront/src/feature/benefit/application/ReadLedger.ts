import type { StorefrontSession } from '../../../entity/session';
import type { BenefitPort } from '../public/BenefitPort';
import type { BenefitEntry } from '../model/BenefitEntry';
export class ReadLedger {
  constructor(private readonly gateway: Pick<BenefitPort, 'ledger'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> {
    return this.gateway.ledger(session, signal);
  }
}
