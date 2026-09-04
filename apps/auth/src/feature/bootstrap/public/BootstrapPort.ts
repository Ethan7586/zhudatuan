import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Bootstrap } from '../model/Bootstrap';

export interface BootstrapPort {
  read(request: SessionRequest, signal?: AbortSignal): Promise<Bootstrap>;
  clear(target?: SessionRequest['target']): void;
}
