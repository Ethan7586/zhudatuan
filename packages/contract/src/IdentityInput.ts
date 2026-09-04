import type { OperationTarget } from './Surface';
import type { CONSUMER_TARGETS } from './Surface';

export type IdentityTarget = OperationTarget;
export type ConsumerIdentityTarget = (typeof CONSUMER_TARGETS)[number];

export type AuthorizationRequest = Readonly<{
  readonly state: string;
  readonly nonce: string;
  readonly challenge: string;
}>;

type AuthenticationShared = Readonly<{
  readonly target: IdentityTarget;
  readonly returnTarget: string;
  readonly authorization: AuthorizationRequest;
}>;

export type IdentitySessionsCreateBody =
  | Readonly<AuthenticationShared & { method: 'password'; subject: string; password: string }>
  | Readonly<AuthenticationShared & { method: 'otp'; subject: string; challenge: string; code: string }>
  | Readonly<AuthenticationShared & { method: 'federation'; provider: string }>;

export type IdentitySessionsCompleteBody = Readonly<{
  code: string;
  proof: string;
  returnTarget: string;
  authorization: AuthorizationRequest;
}>;

export type IdentityInvitationsResolveBody = Readonly<AuthenticationShared & { code: string }>;

export type IdentityInvitationsCreateBody =
  | Readonly<{
      kind: 'enrollment';
      target: ConsumerIdentityTarget;
      organizationId: string;
      employee: Readonly<{ displayName: string; mobile: string; employeeNo?: string; departmentId?: string }>;
      expiresAt: string;
      reason: string;
    }>
  | Readonly<{ kind: 'campaign'; target: ConsumerIdentityTarget; organizationId: string; maxUses: number; expiresAt: string; reason: string }>
  | Readonly<{ kind: 'signin'; target: IdentityTarget; membershipId: string; expiresAt: string; reason: string }>;

export type IdentityInvitationsRevokeBody = Readonly<{ reason: string }>;

export type IdentityEnrollmentsCompleteBody =
  | Readonly<{
      mode: 'bound';
      challenge: string;
      code: string;
      password: string;
      displayName?: string;
      termsAccepted: true;
      termsHash: string;
      authorization: AuthorizationRequest;
    }>
  | Readonly<{
      mode: 'campaign';
      subject: string;
      challenge: string;
      code: string;
      password: string;
      displayName: string;
      termsAccepted: true;
      termsHash: string;
      authorization: AuthorizationRequest;
    }>;

type InvitationReadQuery = Readonly<{
  limit?: string | number;
  cursor?: string;
  target?: IdentityTarget;
  kind?: 'signin' | 'enrollment' | 'campaign';
  status?: 'draft' | 'active' | 'exhausted' | 'revoked' | 'expired';
}>;

type ProviderManageBody = Readonly<{
  type: 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc';
  issuer: string | null;
  scopes: readonly string[];
  status: 'draft' | 'enabled' | 'disabled' | 'revoked';
  clientid: string;
  secretref: string;
}>;

type EmptyInput = Readonly<Record<never, never>>;

export type IdentityOperationInputs = Readonly<{
  'identity.sessions.create': Readonly<{ body: IdentitySessionsCreateBody }>;
  'identity.sessions.complete': Readonly<{ body: IdentitySessionsCompleteBody }>;
  'identity.invitations.resolve': Readonly<{ body: IdentityInvitationsResolveBody }>;
  'identity.invitations.read': Readonly<{ query?: InvitationReadQuery }>;
  'identity.invitations.create': Readonly<{ body: IdentityInvitationsCreateBody }>;
  'identity.invitations.revoke': Readonly<{ path: Readonly<{ id: string }>; body: IdentityInvitationsRevokeBody }>;
  'identity.enrollments.read': Readonly<{ path: Readonly<{ id: string }>; query?: EmptyInput }>;
  'identity.enrollments.complete': Readonly<{ path: Readonly<{ id: string }>; body: IdentityEnrollmentsCompleteBody }>;
  'identity.bootstrap.read': Readonly<{ query?: Readonly<{ returntarget?: string; returnpath?: string }> }>;
  'identity.providers.read': Readonly<{ query?: Readonly<{ returntarget?: string }> }>;
  'identity.federations.start': Readonly<{ body: Readonly<{ providerid: string; returntarget: string; authorization: AuthorizationRequest }> }>;
  'identity.federations.callback': Readonly<{ path: Readonly<{ providerid: string }>; query?: Readonly<{ state: string; code: string }> }>;
  'identity.federations.selection.read': Readonly<{ query?: EmptyInput }>;
  'identity.federations.complete': Readonly<{ body: Readonly<{ membershipid: string }> }>;
  'identity.links.read': Readonly<{ query?: EmptyInput }>;
  'identity.links.create': Readonly<{ body: Readonly<{ providerid: string; returntarget: string; authorization: AuthorizationRequest }> }>;
  'identity.links.revoke': Readonly<{ path: Readonly<{ linkid: string }>; body: EmptyInput }>;
  'identity.providers.manage': Readonly<{ path: Readonly<{ providerid: string }>; body: ProviderManageBody }>;
  'identity.providers.test': Readonly<{ path: Readonly<{ providerid: string }>; body: EmptyInput }>;
}>;
