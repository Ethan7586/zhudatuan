import type { AuthenticationOutcome, AuthTarget, EnrollmentState, MembershipSelectionState, ProviderChoice } from './AuthenticationState';

export interface AuthClient {
  password(subject: string, password: string, target: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  otp(subject: string, challenge: string, code: string, target: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  invitation(code: string, target: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  invitationProof(reference: string, code: string, target: AuthTarget, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  challenge(destination: string, purpose: 'login' | 'password_reset' | 'enrollment', target?: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<Readonly<{ id: string; expiresAt: string }>>;
  enrollment(id: string, signal?: AbortSignal): Promise<EnrollmentState>;
  completeEnrollment(
    input: Readonly<{
      id: string;
      subject: string;
      challenge: string;
      code: string;
      termsHash: string;
      password: string;
      displayName: string;
    }>,
    signal?: AbortSignal
  ): Promise<AuthenticationOutcome>;
  providers(returnTarget: string | undefined, target: AuthTarget, signal?: AbortSignal): Promise<readonly ProviderChoice[]>;
  provider(provider: string, target: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  membershipSelection(target: AuthTarget, signal?: AbortSignal): Promise<MembershipSelectionState>;
  selectMembership(membership: string, target: AuthTarget, returnTarget?: string, signal?: AbortSignal): Promise<AuthenticationOutcome>;
  resetPassword(challenge: string, code: string, password: string, signal?: AbortSignal): Promise<void>;
}
