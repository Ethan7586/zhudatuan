import type { Credential } from '../model/Credential';
import type { LoginPort } from '../public/LoginPort';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';

export class Authenticate {
  constructor(private readonly port: LoginPort) {}
  execute(credential: Credential, signal?: AbortSignal) {
    return this.port.authenticate(credential, signal);
  }
  proof(reference: string, code: string, session: SessionRequest, signal?: AbortSignal) {
    return this.port.proof(reference, code, session, signal);
  }
}
