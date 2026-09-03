import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { Bootstrap } from '../model/Bootstrap';

export interface BootstrapPort {
  read(target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal): Promise<Bootstrap>;
  clear(target?: AuthTarget): void;
}
