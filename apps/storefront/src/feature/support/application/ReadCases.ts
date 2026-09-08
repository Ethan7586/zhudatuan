import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';
import type { SupportPage } from '../model/SupportCase';
import { readCursorPages } from '../../../shared/api/CursorPage';

export class ReadCases {
  constructor(private readonly gateway: Pick<SupportPort, 'cases' | 'case'>) {}
  async list(session: StorefrontSession, signal?: AbortSignal): Promise<SupportPage> {
    const pages = await readCursorPages((cursor) => this.gateway.cases(session, cursor ?? undefined, signal), signal);
    return Object.freeze({ items: Object.freeze(pages.flatMap(({ items }) => items)) });
  }
  detail(session: StorefrontSession, caseId: string, signal?: AbortSignal) {
    return this.gateway.case(session, caseId, signal);
  }
}
