import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';
import type { SupportPage } from '../model/SupportCase';

export class ReadCases {
  constructor(private readonly gateway: Pick<SupportPort, 'cases' | 'case'>) {}
  list(session: StorefrontSession, signal?: AbortSignal): Promise<SupportPage> {
    return this.gateway.cases(session, undefined, signal);
  }
  detail(session: StorefrontSession, caseId: string, signal?: AbortSignal) {
    return this.gateway.case(session, caseId, signal);
  }
}
