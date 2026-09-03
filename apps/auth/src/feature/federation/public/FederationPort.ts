import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { FederationRedirect, Provider } from '../model/Provider';

export interface FederationPort {
  read(target: AuthTarget, signal?: AbortSignal): Promise<readonly Provider[]>;
  start(provider: string, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal): Promise<FederationRedirect>;
}
