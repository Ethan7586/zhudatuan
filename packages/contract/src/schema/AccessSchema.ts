import { array, boolean, discriminatedUnion, lazy, literal, null as nullSchema, number, optional, strictObject, string, union, undefined as undefinedSchema, type ZodMiniType } from 'zod/mini';
import { OPERATION_SCOPE_KINDS } from '../Operation';
import { OPERATION_TARGETS } from '../Surface';
import { ACCESS_ROLE_TEMPLATE_CODES } from '../Vocabulary';
import { createdInvitation } from './IdentitySchema';

const text = string();
const nullableText = union([text, nullSchema()]);
const target = literal(OPERATION_TARGETS);
const scopeKind = literal(OPERATION_SCOPE_KINDS);
const count = number();
const redirect = strictObject({ location: text });
const page = <T>(item: ZodMiniType<T>) => strictObject({ items: array(item), count, nextCursor: optional(text) });

const scope = strictObject({ kind: scopeKind, id: text, tenant: optional(text), name: optional(text), path: optional(array(strictObject({ kind: scopeKind, id: text }))) });
const identityLink = strictObject({ id: text, provider: text, status: literal(['active', 'revoked']), version: number() });
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
const directoryRun = strictObject({
  id: text,
  mode: literal(['full', 'incremental', 'event', 'reconcile']),
  preview: boolean(),
  state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']),
  read_count: number(),
  applied_count: number(),
  create_count: number(),
  update_count: number(),
  freeze_count: number(),
  restore_count: number(),
  conflict_count: number(),
  ignored_count: number(),
  watermark: nullableText,
  started_at: nullableText,
  completed_at: nullableText,
  created_at: text,
});

interface NavigationContractNode {
  readonly key: string;
  readonly title: string;
  readonly parent: string | null;
  readonly order: number;
  readonly operation: string;
  readonly experience: Readonly<{
    icon: string;
    routeKey: string;
    route: string;
    component: string;
    placement: 'primary' | 'secondary' | 'contextual';
    disabled: boolean;
    disabledReason: string | null;
    breadcrumbs: readonly Readonly<{ key: string; title: string }>[];
  }>;
  readonly children: readonly NavigationContractNode[];
}
const navigationNode: ZodMiniType<NavigationContractNode> = lazy(() =>
  strictObject({
    key: text,
    title: text,
    parent: nullableText,
    order: number(),
    operation: text,
    experience: strictObject({ icon: text, routeKey: text, route: text, component: text, placement: literal(['primary', 'secondary', 'contextual']), disabled: boolean(), disabledReason: nullableText, breadcrumbs: array(strictObject({ key: text, title: text })) }),
    children: array(navigationNode),
  })
) as ZodMiniType<NavigationContractNode>;
const ownerIdentity = strictObject({ membership: text, member: text, principal: text, displayName: text });
const ownershipTransfer = strictObject({
  id: text,
  state: literal(['draft', 'pending', 'accepted', 'cancelled', 'expired']),
  sourceMembership: text,
  targetMembership: text,
  targetMember: text,
  targetPrincipal: text,
  targetDisplayName: text,
  formerOwnerMode: literal(['retain_admin', 'remove_admin']),
  formerOwnerRole: nullableText,
  formerOwnerRoleVersion: union([number(), nullSchema()]),
  coolingUntil: text,
  expiresAt: text,
  version: number(),
});
const ownershipImpact = strictObject({
  sourceMembership: text,
  targetMembership: text,
  ownershipVersion: number(),
  targetAccessVersion: number(),
  formerOwnerRoleVersion: union([number(), nullSchema()]),
  affectedPeople: number(),
  affectedScopes: number(),
  warnings: array(text),
});
const roleImpact = strictObject({ affectedPeople: number(), affectedScopes: number(), addedAllows: array(text), removedAllows: array(text), addedDenies: array(text), removedDenies: array(text) });
const capabilityDisabledReason = literal(['explicitdisabled', 'parentnotgranted', 'dependencyunhealthy', 'notgranted', 'expired', 'retired']);
const capabilityImpact = strictObject({ operations: number(), dependentCapabilities: number(), descendantScopes: number(), navigationAffected: boolean() });
const capabilityDependency = strictObject({ capabilityId: text, name: text, healthy: boolean(), reason: union([capabilityDisabledReason, nullSchema()]) });
const capabilityAssignment = strictObject({
  id: text,
  scopeId: text,
  capabilityId: text,
  name: text,
  kind: literal(['operation', 'feature', 'uiblock', 'quota', 'entitlement']),
  state: literal(['enabled', 'disabled']),
  configuredState: union([literal(['enabled', 'disabled']), nullSchema()]),
  inheritedFrom: nullableText,
  quota: union([number(), nullSchema()]),
  effectiveAt: nullableText,
  expiresAt: nullableText,
  version: number(),
  capabilityVersion: number(),
  dependencyHealthy: boolean(),
  disabledReason: union([capabilityDisabledReason, nullSchema()]),
  dependencies: array(capabilityDependency),
  impact: capabilityImpact,
});
const roleTemplateCode = literal(ACCESS_ROLE_TEMPLATE_CODES);
const roleTemplate = strictObject({ code: roleTemplateCode, name: text, description: text, allows: array(text), denies: array(text), version: number() });
const accessRole = strictObject({
  id: text,
  name: text,
  description: text,
  status: literal(['active', 'disabled']),
  kind: literal(['custom', 'system', 'owner']),
  template: union([roleTemplateCode, nullSchema()]),
  version: number(),
  allows: array(text),
  denies: array(text),
  affectedPeople: number(),
  affectedScopes: number(),
  members: array(strictObject({ membership: text, displayName: text, accessVersion: number() })),
});

export const SECURITY_BODY_SCHEMAS = {
  AccessOwnershipTransfersPreviewInput: strictObject({ targetMembership: string(), targetAccessVersion: number(), formerOwnerMode: literal(['retain_admin', 'remove_admin']), formerOwnerRole: optional(string()), reason: string() }),
  AccessOwnershipTransfersCreateInput: strictObject({ targetMembership: string(), targetAccessVersion: number(), formerOwnerMode: literal(['retain_admin', 'remove_admin']), formerOwnerRole: optional(string()), reason: string() }),
  AccessOwnershipTransfersAcceptPreviewInput: strictObject({}),
  AccessOwnershipTransfersAcceptInput: strictObject({}),
  AccessOwnershipTransfersCancelPreviewInput: strictObject({ reason: string() }),
  AccessOwnershipTransfersCancelInput: strictObject({ reason: string() }),
  AccessRolesManageInput: discriminatedUnion('action', [
    strictObject({ action: literal('save'), name: string(), description: string(), template: optional(roleTemplateCode), allows: array(string()), denies: array(string()) }),
    strictObject({ action: literal('status'), status: literal(['active', 'disabled']) }),
    strictObject({ action: literal('assign'), targetMembership: string() }),
    strictObject({ action: literal('revoke'), targetMembership: string() }),
    strictObject({ action: literal('delete') }),
  ]),
  AccessOverridesManageInput: discriminatedUnion('action', [
    strictObject({ action: literal('set'), targetMembership: string(), permission: string(), effect: literal(['allow', 'deny']), expiresAt: optional(string()), reason: string() }),
    strictObject({ action: literal('revoke'), targetMembership: string(), permission: string(), reason: string() }),
  ]),
  AccessScopesManageInput: strictObject({ targetMembership: string(), kind: scopeKind, scope: string(), effect: optional(literal(['allow', 'deny'])), expiresAt: optional(string()) }),
  CapabilityAssignmentsManageInput: strictObject({
    capability: string(),
    state: literal(['enabled', 'disabled']),
    quota: optional(union([number(), nullSchema()])),
    expiresAt: optional(union([string(), nullSchema()])),
    reason: string(),
  }),
  OrganizationDirectoriesManageInput: strictObject({
    providerid: string(),
    providertype: literal(['wecomcorp', 'wecomsuite']),
    status: directoryStatus,
    secretref: string(),
    organizationid: string(),
  }),
  OrganizationDirectoriesSyncInput: discriminatedUnion('action', [
    strictObject({ action: literal('start'), mode: optional(literal(['full', 'incremental'])) }),
    strictObject({ action: literal('preview'), mode: optional(literal(['full', 'incremental'])) }),
    strictObject({ action: literal('cancel'), run: string() }),
    strictObject({ action: literal('resume'), run: string() }),
  ]),
  OrganizationDirectoryeventsReceiveInput: strictObject({}),
} as const;

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
    strictObject({ action: literal('create'), enrollment: createdInvitation }),
    strictObject({ action: literal('update'), memberId: text, displayName: text, version: number() }),
    strictObject({ action: literal('disable'), membershipId: text, status: literal('suspended'), accessVersion: number() }),
    strictObject({ action: literal('enable'), membershipId: text, status: literal('active'), accessVersion: number() }),
    strictObject({ action: literal('offboard'), membershipId: text, status: literal('left'), accessVersion: number() }),
    strictObject({
      action: literal('registrationReset'), memberId: text, principalId: text, status: literal('reset'), loginIdentityReleased: literal(true),
      historyRetained: literal(true), memberships: array(text), accessVersion: number(), profileVersion: number(), principalVersion: number(),
    }),
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

  OrganizationLayersReadOutput: page(strictObject({ id: text, kind: scopeKind, parent_id: nullableText, parent_name: nullableText, name: text, timezone: text, status: literal(['draft', 'active', 'disabled']), version: number() })),
  AccessCenterReadOutput: strictObject({
    items: array(strictObject({
      id: text,
      display_name: text,
      employee_no: nullableText,
      mobile_masked: nullableText,
      client: target,
      status: literal(['invited', 'active', 'suspended', 'left']),
      access_version: number(),
      roles: array(strictObject({ role: text, name: text, description: text, status: literal(['active', 'disabled']), kind: literal(['custom', 'system', 'owner']), template: union([roleTemplateCode, nullSchema()]), version: number(), allows: array(text), denies: array(text) })),
      scopes: array(strictObject({ id: text, kind: scopeKind, scope: text, effect: literal(['allow', 'deny']), expires: nullableText })),
      overrides: array(strictObject({ permission: text, effect: literal(['allow', 'deny']), expires: nullableText })),
    })),
    count,
    nextCursor: optional(text),
    roles: array(accessRole),
    templates: array(roleTemplate),
    separationRules: array(strictObject({ left: text, right: text, reason: text })),
  }),
  AccessOwnershipReadOutput: strictObject({
    state: literal('active'),
    version: number(),
    mobileReady: boolean(),
    owner: ownerIdentity,
    candidates: array(strictObject({ membership: text, member: text, principal: text, displayName: text, roles: array(text), accessVersion: number(), mobileReady: boolean() })),
    formerOwnerRoles: array(strictObject({ id: text, name: text, version: number() })),
    pending: union([ownershipTransfer, nullSchema()]),
  }),
  AccessOwnershipTransfersPreviewOutput: strictObject({ ...ownershipImpact.shape, state: literal('draft'), formerOwnerMode: literal(['retain_admin', 'remove_admin']), formerOwnerRole: nullableText, coolingUntil: text, expiresAt: text }),
  AccessOwnershipTransfersCreateOutput: ownershipTransfer,
  AccessOwnershipTransfersAcceptPreviewOutput: strictObject({ transfer: ownershipTransfer, impact: ownershipImpact }),
  AccessOwnershipTransfersAcceptOutput: strictObject({ ownership: strictObject({
    state: literal('active'), version: number(), mobileReady: boolean(), owner: ownerIdentity,
    candidates: array(strictObject({ membership: text, member: text, principal: text, displayName: text, roles: array(text), accessVersion: number(), mobileReady: boolean() })),
    formerOwnerRoles: array(strictObject({ id: text, name: text, version: number() })), pending: union([ownershipTransfer, nullSchema()]),
  }), transfer: ownershipTransfer }),
  AccessOwnershipTransfersCancelPreviewOutput: strictObject({ transfer: ownershipTransfer, impact: ownershipImpact, reason: text }),
  AccessOwnershipTransfersCancelOutput: ownershipTransfer,
  AccessRolesManageOutput: union([
    strictObject({ action: literal('save'), id: text, scopeId: text, name: text, description: text, status: literal(['active', 'disabled']), version: number(), allowCount: number(), denyCount: number(), template: union([roleTemplateCode, nullSchema()]), impact: roleImpact }),
    strictObject({ action: literal('status'), id: text, status: literal(['active', 'disabled']), version: number(), impact: roleImpact }),
    strictObject({ action: literal(['assign', 'revoke']), id: text, targetMembership: text, accessVersion: number(), changed: literal(true) }),
    strictObject({ action: literal('delete'), id: text, version: number(), deleted: literal(true), impact: roleImpact }),
  ]),
  AccessOverridesManageOutput: strictObject({ targetMembership: text, permission: text, effect: literal(['allow', 'deny']), expiresAt: nullableText, revoked: boolean(), accessVersion: number() }),
  AccessScopesManageOutput: strictObject({ id: text, membershipId: text, kind: scopeKind, scope: text, effect: literal(['allow', 'deny']), expiresAt: nullableText, accessVersion: number() }),
  CapabilityAssignmentsReadOutput: page(capabilityAssignment),
  CapabilityAssignmentsManageOutput: capabilityAssignment,

  NavigationTreeReadOutput: strictObject({ scope: strictObject({ id: text, kind: scopeKind }), target, version: text, etag: text, generatedAt: text, catalogVersion: text, defaultKey: text, defaultRoute: text, nodes: array(navigationNode) }),
  NavigationCatalogReadOutput: strictObject({
    version: text,
    hash: text,
    nodes: number(),
    roots: number(),
    surfaces: strictObject({ auth: number(), console: number(), storefront: number(), miniapp: number(), store: number(), supplier: number() }),
    orphans: array(text),
  }),
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
  OrganizationDirectoriesSyncOutput: strictObject({ id: text, state: literal(['queued', 'running', 'completed', 'failed', 'cancelled']), mode: literal(['full', 'incremental']), preview: boolean() }),
  OrganizationDirectoriesSyncrunsReadOutput: page(directoryRun),
  OrganizationDirectoryeventsReceiveOutput: undefinedSchema(),
} as const;
