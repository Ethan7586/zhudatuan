import type { Recovery } from '../model/Recovery';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';

export interface RecoveryPort {
  reset(input: Recovery, session: SessionRequest, signal?: AbortSignal): Promise<void>;
}
