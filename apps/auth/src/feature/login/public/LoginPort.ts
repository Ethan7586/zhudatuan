import type { Credential } from '../model/Credential';
import type { LoginOutcome } from '../model/Login';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';

export interface LoginPort {
  authenticate(credential: Credential, signal?: AbortSignal): Promise<LoginOutcome>;
  proof(reference: string, code: string, session: SessionRequest, signal?: AbortSignal): Promise<LoginOutcome>;
}
