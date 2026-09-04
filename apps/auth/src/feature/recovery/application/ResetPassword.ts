import type { Recovery } from '../model/Recovery';
import type { RecoveryPort } from '../public/RecoveryPort';

export class ResetPassword {
  constructor(private readonly port: RecoveryPort) {}
  execute(input: Recovery, signal?: AbortSignal) {
    return this.port.reset(input, signal);
  }
}
