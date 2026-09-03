import type { Recovery } from '../model/Recovery';

export interface RecoveryPort {
  reset(input: Recovery, signal?: AbortSignal): Promise<void>;
}
