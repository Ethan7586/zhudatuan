import type { AuthReturnRequest } from '../../../entity/authentication/AuthClient';
import type { AuthTarget, AuthenticationOutcome } from '../../../entity/authentication/AuthenticationState';

export interface InvitationResolution {
  readonly code: string;
  readonly target: AuthTarget;
  readonly returns?: AuthReturnRequest;
  readonly signal?: AbortSignal;
}

export type InvitationOutcome = AuthenticationOutcome;
