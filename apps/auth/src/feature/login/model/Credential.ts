import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';

interface CredentialContext {
  readonly target: AuthTarget;
  readonly returns: Omit<AuthRequest, 'target'>;
}

export type Credential =
  | Readonly<CredentialContext & { kind: 'password'; subject: string; password: string }>
  | Readonly<CredentialContext & { kind: 'otp'; subject: string; challenge: string; code: string }>;
