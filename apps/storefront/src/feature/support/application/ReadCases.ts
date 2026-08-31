import type { StorefrontSession } from '../../../shared/api/Session';
import { SupportGateway } from '../infrastructure/SupportGateway';
import type { SupportPage } from '../model/SupportCase';

export function readCases(session: StorefrontSession, signal?: AbortSignal): Promise<SupportPage> {
  return SupportGateway.cases(session, undefined, signal);
}
