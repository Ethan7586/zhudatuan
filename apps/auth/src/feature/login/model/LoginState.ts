import type { AuthTarget } from '@shop/config/client';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap, LoginMethod } from '../../bootstrap';
import type { EnrollmentState } from '../../enrollment';
import type { Membership } from '../../membership';
import type { LoginProofMethod } from './Login';
import type { Challenge } from '../../challenge';

interface BaseState {
  readonly target: AuthTarget;
  readonly method: LoginMethod;
  readonly accepted: boolean;
  readonly command: number;
  readonly notice?: string;
}

interface BootstrappedState extends BaseState {
  readonly bootstrap: Bootstrap;
}

export type LoginState =
  | Readonly<BaseState & { phase: 'bootstrapping' }>
  | Readonly<BaseState & { phase: 'bootstrapfailure'; failure: FailureView }>
  | Readonly<BootstrappedState & { phase: 'ready' }>
  | Readonly<BootstrappedState & { phase: 'challengepending' }>
  | Readonly<BootstrappedState & { phase: 'submitting' }>
  | Readonly<BootstrappedState & { phase: 'resolvinginvitation' }>
  | Readonly<BootstrappedState & { phase: 'exchangingticket'; redirectUrl: string }>
  | Readonly<BootstrappedState & { phase: 'enrollment'; enrollment: EnrollmentState; submitting: boolean }>
  | Readonly<BootstrappedState & { phase: 'proof'; reference: string; methodKind: LoginProofMethod; expiresAt: string; challenge?: Challenge }>
  | Readonly<BootstrappedState & { phase: 'membershipselection'; memberships: readonly Membership[] }>
  | Readonly<BootstrappedState & { phase: 'redirecting'; redirectUrl: string }>
  | Readonly<BootstrappedState & { phase: 'recoverablefailure'; failure: FailureView }>
  | Readonly<BaseState & { phase: 'terminalfailure'; failure: FailureView }>
  | Readonly<BaseState & { phase: 'cancelled' }>;

export function initialLoginState(target: AuthTarget): LoginState {
  return Object.freeze({ phase: 'bootstrapping', target, method: 'password', accepted: false, command: 1 });
}

export type LoginEvent =
  | Readonly<{ type: 'BOOTSTRAP_REQUESTED'; target: AuthTarget }>
  | Readonly<{ type: 'BOOTSTRAP_SUCCEEDED'; command: number; bootstrap: Bootstrap }>
  | Readonly<{ type: 'BOOTSTRAP_FAILED'; command: number; failure: FailureView }>
  | Readonly<{ type: 'METHOD_CHANGED'; method: LoginMethod }>
  | Readonly<{ type: 'TARGET_CHANGED'; target: AuthTarget }>
  | Readonly<{ type: 'ACCEPTANCE_CHANGED'; accepted: boolean }>
  | Readonly<{ type: 'NOTICE_CHANGED'; notice: string }>
  | Readonly<{ type: 'CHALLENGE_REQUESTED' }>
  | Readonly<{ type: 'CHALLENGE_SUCCEEDED'; command: number; notice: string }>
  | Readonly<{ type: 'CHALLENGE_FAILED'; command: number; failure: FailureView }>
  | Readonly<{ type: 'SUBMIT_REQUESTED'; invitation?: boolean }>
  | Readonly<{ type: 'AUTHENTICATED'; command: number; redirectUrl: string }>
  | Readonly<{ type: 'INVITATION_RESOLVED'; command: number }>
  | Readonly<{ type: 'TICKET_EXCHANGED'; command: number }>
  | Readonly<{ type: 'ENROLLMENT_REQUIRED'; command: number; enrollment: EnrollmentState }>
  | Readonly<{ type: 'ENROLLMENT_SUBMIT_REQUESTED' }>
  | Readonly<{ type: 'ENROLLMENT_FAILED'; command: number; failure: FailureView }>
  | Readonly<{ type: 'PROOF_REQUIRED'; command: number; reference: string; method: LoginProofMethod; expiresAt: string; challenge?: Challenge }>
  | Readonly<{ type: 'MEMBERSHIP_REQUIRED'; command: number; memberships: readonly Membership[] }>
  | Readonly<{ type: 'ENROLLMENT_COMPLETED'; command: number; notice: string }>
  | Readonly<{ type: 'RECOVERABLE_FAILED'; command: number; failure: FailureView }>
  | Readonly<{ type: 'TERMINAL_FAILED'; command: number; failure: FailureView }>
  | Readonly<{ type: 'CANCELLED'; command: number }>
  | Readonly<{ type: 'RETRY_REQUESTED' }>
  | Readonly<{ type: 'BACK_REQUESTED' }>;
