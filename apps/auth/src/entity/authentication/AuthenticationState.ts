export type AuthTarget = 'console' | 'storefront';
export type AuthMethod = 'password' | 'otp' | 'invitation';

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

export interface EnrollmentPolicy {
  readonly termsTitle: string;
  readonly termsBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: string;
  readonly termsHash: string;
}

export interface EnrollmentState {
  readonly id: string;
  readonly expiresAt: string;
  readonly target: AuthTarget;
  readonly policy: EnrollmentPolicy;
}

export interface ProviderChoice {
  readonly id: string;
  readonly type: 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc';
}
