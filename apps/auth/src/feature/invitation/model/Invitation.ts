import type { LoginOutcome } from '../../login';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';

export interface InvitationResolution {
  readonly code: string;
  readonly session: SessionRequest;
  readonly signal?: AbortSignal;
}

export type InvitationOutcome = LoginOutcome;
