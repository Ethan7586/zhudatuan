import type { Recovery } from '../model/Recovery';
import type { RecoveryPort } from '../public/RecoveryPort';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';

export class ResetPassword {
  constructor(private readonly port: RecoveryPort) {}
  execute(input: Recovery, session: SessionRequest, signal?: AbortSignal) {
    return this.port.reset(input, session, signal);
  }
}
