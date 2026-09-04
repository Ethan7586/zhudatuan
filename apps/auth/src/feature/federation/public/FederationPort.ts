import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { FederationRedirect, Provider } from '../model/Provider';

export interface FederationPort {
  read(session: SessionRequest, signal?: AbortSignal): Promise<readonly Provider[]>;
  start(provider: string, session: SessionRequest, signal?: AbortSignal): Promise<FederationRedirect>;
}
