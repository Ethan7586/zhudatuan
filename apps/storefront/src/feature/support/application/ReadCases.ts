import type { StorefrontSession } from '../../../shared/api/Session';
import { supportGateway } from '../infrastructure/SupportGateway';
import type { SupportPage } from '../model/SupportCase';

export function readCases(session: StorefrontSession, signal?: AbortSignal): Promise<SupportPage> {
  return supportGateway.cases(session, undefined, signal);
}

export async function readCase(session: StorefrontSession, caseId: string, signal?: AbortSignal) {
  return supportGateway.case(session, caseId, signal);
}
