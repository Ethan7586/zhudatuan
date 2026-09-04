import type { SessionRequest } from '../../../shared/security/ReturnTarget';

interface CredentialContext {
  readonly session: SessionRequest;
}

export type Credential = Readonly<CredentialContext & { kind: 'password'; subject: string; password: string }> | Readonly<CredentialContext & { kind: 'otp'; subject: string; challenge: string; code: string }>;
