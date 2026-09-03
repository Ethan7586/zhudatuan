import type { Credential } from '../model/Credential';
import type { LoginOutcome } from '../model/Login';

export interface LoginPort {
  authenticate(credential: Credential, signal?: AbortSignal): Promise<LoginOutcome>;
  proof(reference: string, code: string, credential: Pick<Credential, 'target' | 'returns'>, signal?: AbortSignal): Promise<LoginOutcome>;
}
