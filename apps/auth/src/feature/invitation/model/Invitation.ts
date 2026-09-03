import type { AuthTarget } from '@shop/config/client';
import type { LoginOutcome } from '../../login/model/Login';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';

export interface InvitationResolution {
  readonly code: string;
  readonly target: AuthTarget;
  readonly returns: Omit<AuthRequest, 'target'>;
  readonly signal?: AbortSignal;
}

export type InvitationOutcome = LoginOutcome;
