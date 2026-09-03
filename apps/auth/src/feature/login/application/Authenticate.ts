import type { Credential } from '../model/Credential';
import type { LoginPort } from '../public/LoginPort';

export class Authenticate {
  constructor(private readonly port: LoginPort) {}
  execute(credential: Credential, signal?: AbortSignal) {
    return this.port.authenticate(credential, signal);
  }
  proof(reference: string, code: string, context: Pick<Credential, 'target' | 'returns'>, signal?: AbortSignal) {
    return this.port.proof(reference, code, context, signal);
  }
}
