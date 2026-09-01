import { array, boolean, lazy, literal, null as nullSchema, number, optional, strictObject, string, union, undefined as undefinedSchema, type ZodMiniType } from 'zod/mini';

const text = string();
const nullableText = union([text, nullSchema()]);
const target = literal(['console', 'storefront']);
const scopeKind = literal(['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand', 'self', 'owner']);
const count = number();
const redirect = strictObject({ location: text });
const page = (item: ZodMiniType) => strictObject({ items: array(item), count, nextCursor: optional(text) });

const scope = strictObject({ kind: scopeKind, id: text, tenant: optional(text), name: optional(text), path: optional(array(strictObject({ kind: scopeKind, id: text }))) });
const identityLink = strictObject({ id: text, provider: text, principal: text, status: literal(['active', 'revoked']), version: number() });
const providerType = literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']);
const providerStatus = literal(['draft', 'enabled', 'disabled', 'revoked']);
const provider = strictObject({
  id: text,
  type: providerType,
  tenantid: text,
  issuer: nullableText,
  clientid: text,
  secretref: text,
  status: providerStatus,
  redirecturi: text,
  scopes: array(text),
  version: number(),
  createdat: text,
  updatedat: text,
});
const directoryStatus = literal(['draft', 'enabled', 'paused', 'disabled', 'revoked']);
const directory = strictObject({ id: text, tenantid: text, organizationid: text, providerid: text, providertype: literal(['wecomcorp', 'wecomsuite']), status: directoryStatus, successfulversion: number(), version: number() });

const navigationNode: ZodMiniType = lazy(() => strictObject({ id: text, title: text, icon: text, route: text, component: text, order: number(), entry: text, disabled: boolean(), children: array(navigationNode) }));

export const SECURITY_OUTPUT_SCHEMAS = {
  IdentitySessionReadOutput: strictObject({
    actor: text,
    session: text,
    membership: text,
    scope,
    scopes: array(scope),
    accessVersion: number(),
    permissions: array(text),
    capabilities: array(text),
    assurance: strictObject({ level: number(), verified: optional(text) }),
    target,
    security: strictObject({ hasLocalCredential: boolean(), phoneMasked: nullableText, passwordChangedAt: nullableText }),
    syncedAt: text,
    csrf: optional(text),
  }),
  IdentitySessionDeleteOutput: strictObject({ session: text, revokedAt: text }),
  IdentitySessionsReadOutput: page(strictObject({ id: text, membership: text, client: target, deviceLabel: text, userAgent: text, assurance: number(), createdAt: text, lastSeenAt: text, expiresAt: text, current: boolean() })),
  IdentitySessionsRevokeOutput: strictObject({ target: text, revoked: number(), sessions: array(text) }),
  IdentityMembersManageOutput: union([
    strictObject({ action: literal('update'), memberId: text, displayName: text, version: number() }),
    strictObject({ action: literal('status'), membershipId: text, status: literal(['active', 'suspended', 'left']), accessVersion: number() }),
  ]),
  IdentityPasswordChangeOutput: strictObject({ credentialVersion: number(), version: number() }),
  IdentityPasswordVerifyOutput: strictObject({ verified: literal(true), verifiedAt: text }),
  IdentityPasswordResetOutput: strictObject({ credentialVersion: number(), version: number() }),
  IdentityMobileManageOutput: strictObject({ memberId: text, displayName: text, mobileMasked: text, version: number() }),
  IdentityStepupStartOutput: strictObject({ id: text, purpose: literal('stepup'), expiresAt: text, actionBound: boolean() }),
  IdentityStepupCompleteOutput: union([strictObject({ session: text, assurance: number() }), strictObject({ session: text, assurance: number(), proof: text, expiresAt: text })]),
  IdentityStepupDisableOutput: strictObject({ session: text, assurance: number() }),
  IdentityLinksReadOutput: strictObject({ items: array(identityLink), count }),
  IdentityLinksCreateOutput: redirect,
  IdentityLinksRevokeOutput: undefinedSchema(),
  IdentityProvidersManageOutput: provider,
  IdentityProvidersTestOutput: strictObject({ status: literal(['healthy', 'degraded', 'unavailable']), checkedat: text }),

  OrganizationLayersReadOutput: page(strictObject({ id: text, kind: scopeKind, parent_id: nullableText, name: text, timezone: text, status: literal(['draft', 'active', 'disabled']), version: number() })),
  AccessCenterReadOutput: page(
    strictObject({
      id: text,
      client: target,
      status: literal(['invited', 'active', 'suspended', 'left']),
      access_version: number(),
      roles: array(strictObject({ role: text, name: text, kind: literal(['custom', 'system', 'owner']), version: number(), allows: array(text), denies: array(text) })),
      scopes: array(strictObject({ id: text, kind: scopeKind, scope: text, effect: literal(['allow', 'deny']), expires: nullableText })),
      overrides: array(strictObject({ permission: text, effect: literal(['allow', 'deny']), expires: nullableText })),
    })
  ),
  AccessOwnersTransferOutput: strictObject({ scope: text, previousMembership: text, membership: text, previousAccessVersion: number(), accessVersion: number(), version: number() }),
  AccessRolesManageOutput: strictObject({ id: text, scopeId: text, name: text, status: literal('active'), version: number(), allowCount: number(), denyCount: number() }),
  AccessOverridesManageOutput: strictObject({ targetMembership: text, permission: text, effect: literal(['allow', 'deny']), expiresAt: nullableText, revoked: boolean(), accessVersion: number() }),
  AccessScopesManageOutput: strictObject({ id: text, membershipId: text, kind: scopeKind, scope: text, effect: literal(['allow', 'deny']), expiresAt: nullableText, accessVersion: number() }),
  CapabilityAssignmentsReadOutput: page(
    strictObject({ id: text, scopeId: text, capabilityId: text, name: text, state: literal(['enabled', 'disabled']), quota: union([number(), nullSchema()]), effectiveAt: text, expiresAt: nullableText, version: number() })
  ),
  CapabilityAssignmentsManageOutput: strictObject({
    id: text,
    scopeId: text,
    capabilityId: text,
    state: literal(['enabled', 'disabled']),
    quota: union([number(), nullSchema()]),
    effectiveAt: text,
    expiresAt: nullableText,
    version: number(),
  }),

  NavigationTreeReadOutput: strictObject({ scope: strictObject({ id: text, kind: scopeKind }), target, version: text, etag: text, generatedAt: text, catalogVersion: text, nodes: array(navigationNode) }),
  NavigationCatalogReadOutput: strictObject({ version: text, hash: text, nodes: number(), roots: number(), surfaces: strictObject({ console: number(), storefront: number() }), orphans: array(text) }),
  NavigationHealthReadOutput: strictObject({
    status: literal(['healthy', 'degraded']),
    catalogHash: text,
    catalogReadable: boolean(),
    nodes: number(),
    cache: literal(['available', 'degraded']),
    cacheReason: nullableText,
    lastEventAt: nullableText,
  }),

  OrganizationDirectoriesReadOutput: page(
    strictObject({ id: text, organization_id: text, type: literal(['wecomcorp', 'wecomsuite']), status: directoryStatus, successful_version: number(), version: number(), updated_at: text, last_success_at: nullableText })
  ),
  OrganizationDirectoriesManageOutput: directory,
  OrganizationDirectoriesSyncOutput: strictObject({ id: text, state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']), mode: literal(['full', 'incremental']) }),
  OrganizationDirectoriesSyncrunsReadOutput: page(
    strictObject({
      id: text,
      mode: literal(['full', 'incremental', 'event', 'reconcile']),
      state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']),
      read_count: number(),
      applied_count: number(),
      conflict_count: number(),
      ignored_count: number(),
      watermark: nullableText,
      started_at: nullableText,
      completed_at: nullableText,
      created_at: text,
    })
  ),
  OrganizationDirectoryeventsReceiveOutput: undefinedSchema(),
} as const;
