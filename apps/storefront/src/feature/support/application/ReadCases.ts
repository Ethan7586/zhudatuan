import type { StorefrontSession } from '../../../entity/session';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { SupportPage } from '../model/SupportCase';

export class ReadCases {
  constructor(private readonly gateway: Pick<SupportGateway, 'cases' | 'case'>) {}
  list(session: StorefrontSession, signal?: AbortSignal): Promise<SupportPage> { return this.gateway.cases(session, undefined, signal); }
  detail(session: StorefrontSession, caseId: string, signal?: AbortSignal) { return this.gateway.case(session, caseId, signal); }
}
