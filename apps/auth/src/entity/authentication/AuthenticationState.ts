export type AuthTarget = 'console' | 'storefront';
export type AuthMethod = 'password' | 'otp' | 'invite';

export interface MembershipChoice {
  readonly id: string;
  readonly target: AuthTarget;
}

export interface MembershipSelectionState {
  readonly memberships: readonly MembershipChoice[];
  readonly expiresAt: string;
  readonly target: AuthTarget;
}

export type AuthenticationOutcome =
  | Readonly<{ kind: 'authenticated'; redirectUrl: string }>
  | Readonly<{ kind: 'selection'; transaction: string; memberships: readonly MembershipChoice[] }>
  | Readonly<{ kind: 'proofRequired'; reference: string; expiresAt: string; method: 'otp' | 'sso'; target: AuthTarget }>
  | Readonly<{ kind: 'enrollment'; id: string; expiresAt: string }>
  | Readonly<{ kind: 'enrolled'; target: 'storefront' }>;

export type { EnrollmentState } from '../../feature/invitation/model/Enrollment';
export type { RegistrationPolicy as EnrollmentPolicy } from '../../feature/invitation/model/RegistrationPolicy';

export interface ProviderChoice {
  readonly id: string;
  readonly type: 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc';
}
