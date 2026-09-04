import type { AuthTarget } from '@shop/config/client';
import type { OperationOutputFor } from '@shop/contract';
import type { Membership } from '../../membership';
import type { EnrollmentTarget } from '../../enrollment';
import type { Challenge } from '../../challenge';

type ProofOutput = Extract<OperationOutputFor<'identity.sessions.create'>, { kind: 'proofRequired' }>;
export type LoginProofMethod = ProofOutput['proof']['method'];

export type LoginOutcome =
  | Readonly<{ kind: 'authenticated'; redirectUrl: string }>
  | Readonly<{ kind: 'membership'; transaction: string; memberships: readonly Membership[] }>
  | Readonly<{ kind: 'proof'; reference: string; expiresAt: string; method: LoginProofMethod; target: AuthTarget; challenge?: Challenge }>
  | Readonly<{ kind: 'enrollment'; id: string; expiresAt: string; target: EnrollmentTarget }>
  | Readonly<{ kind: 'enrolled'; target: EnrollmentTarget }>;
