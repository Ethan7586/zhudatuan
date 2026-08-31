import { array, boolean, discriminatedUnion, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';

const target = literal(['console', 'storefront']);
const authorization = strictObject({ kind: literal('session'), ticket: string(), returnTarget: string() });
const selection = strictObject({
  kind: literal('selection'),
  transaction: string(),
  memberships: array(strictObject({ id: string(), target })),
});
const proof = strictObject({
  kind: literal('proofRequired'),
  proof: strictObject({ reference: optional(string()), expiresAt: string(), method: literal(['otp', 'sso']), target }),
});
const enrollment = strictObject({
  kind: literal('enrollment'),
  enrollment: strictObject({ id: string(), expiresAt: string(), target: literal('storefront') }),
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
  recipient: union([string(), nullSchema()]),
  issuer_membership_id: string(),
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
const createdInvitation = strictObject({
  id: string(),
  kind: literal(['signin', 'enrollment', 'campaign']),
  target,
  organization_id: string(),
  membership_id: union([string(), nullSchema()]),
  minimum_assurance: number(),
  max_uses: number(),
  use_count: number(),
  not_before: string(),
  expires_at: string(),
  status: literal('active'),
  reason: string(),
  created_at: string(),
  version: number(),
  code: string(),
});

export const IDENTITY_OUTPUT_SCHEMAS = {
  IdentitySessionsCreateOutput: discriminatedUnion('kind', [authorization, selection, proof, enrollment]),
  IdentitySessionsCompleteOutput: authorization,
  IdentityTicketsExchangeOutput: strictObject({ returnTarget, expiresIn: number() }),
  IdentityChallengesCreateOutput: strictObject({ id: string(), purpose: literal(['login', 'password_reset', 'phone_change', 'enrollment']), expires_at: string() }),
  IdentityInvitationsResolveOutput: strictObject({
    kind: literal(['signin', 'enrollment', 'campaign']),
    target,
    expiresAt: string(),
    requiresProof: boolean(),
    requiresEnrollment: boolean(),
    policy: optional(policy),
  }),
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
  IdentityEnrollmentsReadOutput: strictObject({ id: string(), target, expiresAt: string(), policy }),
  IdentityEnrollmentsCompleteOutput: discriminatedUnion('kind', [authorization, strictObject({ kind: literal('enrolled'), target: literal('storefront') })]),
  IdentityFederationsStartOutput: redirect,
  IdentityFederationsCallbackOutput: redirect,
  IdentityFederationsSelectionReadOutput: strictObject({ memberships: array(strictObject({ id: string(), target })), expiresAt: string(), target }),
  IdentityFederationsCompleteOutput: redirect,
  IdentityProvidersReadOutput: strictObject({
    items: array(strictObject({ id: string(), type: literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']), status: literal('enabled') })),
    csrf: string(),
    target,
    returnTarget: string(),
  }),
  IdentityMembershipsReadOutput: strictObject({
    items: array(strictObject({ id: string(), organizationId: string(), name: string(), current: boolean(), accessVersion: number() })),
    count: number(),
  }),
  IdentityMembershipsSwitchOutput: strictObject({ session: string(), membership: string(), expiresIn: number(), switchedAt: string() }),
} as const;
