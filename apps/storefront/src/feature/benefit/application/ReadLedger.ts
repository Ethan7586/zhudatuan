import type { StorefrontSession } from '../../../entity/session';
import { BenefitGateway } from '../infrastructure/BenefitGateway';
import type { BenefitEntry } from '../model/BenefitEntry';
export class ReadLedger {
  constructor(private readonly gateway: Pick<BenefitGateway, 'ledger'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly BenefitEntry[]> { return this.gateway.ledger(session, signal); }
}
