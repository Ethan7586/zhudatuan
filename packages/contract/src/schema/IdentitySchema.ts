import { array, boolean, discriminatedUnion, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { CONSUMER_TARGETS, OPERATION_TARGETS } from '../Surface';

const target = literal(OPERATION_TARGETS);
const membershipShape = {
  id: string(),
  target,
  displayName: string(),
  organizationName: string(),
  scopeKind: string(),
  scopeId: string(),
  roleLabel: string(),
  logoUrl: union([string(), nullSchema()]),
} as const;
const membership = strictObject(membershipShape);
const authorization = strictObject({ kind: literal('session'), ticket: string(), returnTarget: string() });
const selection = strictObject({
  kind: literal('selection'),
  transaction: string(),
  memberships: array(membership),
});
const proof = strictObject({
  kind: literal('proofRequired'),
  proof: strictObject({ reference: optional(string()), expiresAt: string(), method: literal(['otp', 'sso']), target }),
});
const enrollment = strictObject({
  kind: literal('enrollment'),
  enrollment: strictObject({ id: string(), expiresAt: string(), target: literal(CONSUMER_TARGETS) }),
});
const invitationProof = strictObject({
  kind: literal('proofRequired'),
  proof: strictObject({ reference: string(), purpose: literal('invitation_login'), expiresAt: string(), retryAt: string(), attemptsRemaining: number(), method: literal('otp'), target }),
});
const policy = strictObject({
  terms_title: string(),
  terms_body: string(),
  privacy_title: string(),
  privacy_body: string(),
  terms_hash: string(),
});
const returnTarget = strictObject({
  url: string(),
  proof: string(),
  expiresAt: string(),
  target,
  tenant: optional(string()),
});
const redirect = strictObject({ location: string() });
const invitation = strictObject({
  id: string(),
  kind: literal(['signin', 'enrollment', 'campaign']),
  target,
  organization_id: string(),
  membership_id: union([string(), nullSchema()]),
  recipient_display_name: union([string(), nullSchema()]),
  recipient_employee_no: union([string(), nullSchema()]),
  recipient_mobile_masked: union([string(), nullSchema()]),
  issuer_membership_id: string(),
  issuer_display_name: string(),
  issuer_employee_no: union([string(), nullSchema()]),
  issuer_mobile_masked: union([string(), nullSchema()]),
  issuer_access_version: number(),
  minimum_assurance: number(),
  max_uses: number(),
  use_count: number(),
  not_before: string(),
  expires_at: string(),
  status: literal(['draft', 'active', 'exhausted', 'revoked', 'expired']),
  reason: string(),
  created_at: string(),
  revoked_at: union([string(), nullSchema()]),
  revoked_by: union([string(), nullSchema()]),
  revoke_reason: union([string(), nullSchema()]),
  version: number(),
});
export const createdInvitation = strictObject({
  id: string(),
  kind: literal(['signin', 'enrollment', 'campaign']),
  target,
  organizationId: string(),
  membershipId: optional(string()),
  maxUses: number(),
  useCount: number(),
  expiresAt: string(),
  status: literal('active'),
  version: number(),
  code: string(),
  recipientMasked: optional(string()),
  employee: optional(strictObject({ displayName: string(), employeeNo: optional(string()) })),
});

export const IDENTITY_OUTPUT_SCHEMAS = {
  IdentityHandoversCreateOutput: strictObject({ id: string(), scopeId: string(), membershipId: string(), note: string(), handedOverAt: string(), sessionRevokedAt: string(), version: number() }),
  IdentityHandoversReadOutput: strictObject({ items: array(strictObject({ id: string(), scopeId: string(), membershipId: string(), note: string(), handedOverAt: string(), version: number() })), count: number(), nextCursor: optional(string()) }),
  IdentitySessionsCreateOutput: discriminatedUnion('kind', [authorization, selection, proof, enrollment]),
  IdentitySessionsCompleteOutput: authorization,
  IdentityTicketsExchangeOutput: strictObject({ returnTarget, expiresIn: number() }),
  IdentityChallengesCreateOutput: strictObject({ id: string(), purpose: literal(['login', 'password_reset', 'enrollment', 'enrollment_campaign']), expires_at: string(), retry_at: string(), attempts_remaining: number() }),
  IdentityMobileChallengesCreateOutput: strictObject({ id: string(), purpose: literal('phone_change'), expires_at: string(), retry_at: string(), attempts_remaining: number() }),
  IdentityInvitationsResolveOutput: discriminatedUnion('kind', [authorization, invitationProof, enrollment]),
  IdentityInvitationsReadOutput: strictObject({ items: array(invitation), count: number(), nextCursor: optional(string()) }),
  IdentityInvitationsCreateOutput: createdInvitation,
  IdentityInvitationsRevokeOutput: strictObject({
    id: string(),
    kind: literal(['signin', 'enrollment', 'campaign']),
    target,
    status: literal('revoked'),
    revoked_at: string(),
    revoked_by: string(),
    revoke_reason: string(),
    version: number(),
  }),
  IdentityEnrollmentsReadOutput: strictObject({
    id: string(),
    kind: literal(['enrollment', 'campaign']),
    target: literal(CONSUMER_TARGETS),
    expiresAt: string(),
    subjectMode: literal(['bound', 'input']),
    organization: strictObject({ id: string(), name: string() }),
    recipientMasked: optional(string()),
    employee: optional(strictObject({ displayName: string(), employeeNo: optional(string()), departmentName: optional(string()) })),
    policy,
  }),
  IdentityEnrollmentsCompleteOutput: discriminatedUnion('kind', [authorization, strictObject({ kind: literal('enrolled'), target: literal(CONSUMER_TARGETS) })]),
  IdentityFederationsStartOutput: redirect,
  IdentityFederationsCallbackOutput: redirect,
  IdentityFederationsSelectionReadOutput: strictObject({ memberships: array(membership), expiresAt: string(), target }),
  IdentityFederationsCompleteOutput: redirect,
  IdentityBootstrapReadOutput: strictObject({
    target,
    returnTarget: string(),
    expiresAt: string(),
    csrf: string(),
    methods: array(literal(['password', 'otp', 'invitation', 'federation'])),
    preferredMethod: literal(['password', 'otp', 'invitation']),
    password: strictObject({
      minimumLength: number(),
      maximumLength: number(),
      uppercase: boolean(),
      lowercase: boolean(),
      number: boolean(),
      symbol: boolean(),
    }),
    otp: strictObject({ validSeconds: number(), resendSeconds: number() }),
    legal: policy,
  }),
  IdentityProvidersReadOutput: strictObject({
    items: array(strictObject({ id: string(), type: literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']), status: literal('enabled') })),
  }),
  IdentityProvidersCenterReadOutput: strictObject({
    items: array(strictObject({ id: string(), type: literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']), status: literal('enabled') })),
    count: number(),
  }),
  IdentityMembershipsReadOutput: strictObject({
    items: array(strictObject({ ...membershipShape, current: boolean(), accessVersion: number() })),
    count: number(),
  }),
  IdentityMembershipsSwitchOutput: strictObject({ session: string(), membership: string(), expiresIn: number(), switchedAt: string() }),
} as const;
