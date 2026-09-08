import { array, boolean, lazy, literal, null as nullSchema, number, optional, strictObject, string, union, type ZodMiniType } from 'zod/mini';
import { OPERATION_SCOPE_KINDS } from '../Operation';
import { OPERATION_TARGETS } from '../Surface';
import { ACCESS_ROLE_TEMPLATE_CODES } from '../Vocabulary';

export const text = string();
export const nullableText = union([text, nullSchema()]);
export const target = literal(OPERATION_TARGETS);
export const scopeKind = literal(OPERATION_SCOPE_KINDS);
export const count = number();
export const redirect = strictObject({ location: text });
export const page = <T>(item: ZodMiniType<T>) => strictObject({ items: array(item), count, nextCursor: optional(text) });

export const scope = strictObject({ kind: scopeKind, id: text, tenant: optional(text), name: optional(text), path: optional(array(strictObject({ kind: scopeKind, id: text }))) });
export const identityLink = strictObject({ id: text, provider: text, status: literal(['active', 'revoked']), version: number() });
export const providerType = literal(['wechat', 'wecomcorp', 'wecomsuite', 'oidc']);
export const providerStatus = literal(['draft', 'enabled', 'disabled', 'revoked']);
export const provider = strictObject({
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
export const directoryStatus = literal(['draft', 'enabled', 'paused', 'disabled', 'revoked']);
export const directory = strictObject({ id: text, tenantid: text, organizationid: text, providerid: text, providertype: literal(['wecomcorp', 'wecomsuite']), status: directoryStatus, successfulversion: number(), version: number() });
export const directoryRun = strictObject({
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

export interface NavigationContractNode {
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
export const navigationNode: ZodMiniType<NavigationContractNode> = lazy(() =>
  strictObject({
    key: text,
    title: text,
    parent: nullableText,
    order: number(),
    operation: text,
    experience: strictObject({
      icon: text,
      routeKey: text,
      route: text,
      component: text,
      placement: literal(['primary', 'secondary', 'contextual']),
      disabled: boolean(),
      disabledReason: nullableText,
      breadcrumbs: array(strictObject({ key: text, title: text })),
    }),
    children: array(navigationNode),
  })
);
export const ownerIdentity = strictObject({ membership: text, member: text, principal: text, displayName: text });
export const ownershipTransfer = strictObject({
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
export const ownershipImpact = strictObject({
  sourceMembership: text,
  targetMembership: text,
  ownershipVersion: number(),
  targetAccessVersion: number(),
  formerOwnerRoleVersion: union([number(), nullSchema()]),
  affectedPeople: number(),
  affectedScopes: number(),
  warnings: array(text),
});
export const roleImpact = strictObject({ affectedPeople: number(), affectedScopes: number(), addedAllows: array(text), removedAllows: array(text), addedDenies: array(text), removedDenies: array(text) });
export const capabilityDisabledReason = literal(['explicitdisabled', 'parentnotgranted', 'dependencyunhealthy', 'notgranted', 'expired', 'retired']);
export const capabilityImpact = strictObject({ operations: number(), dependentCapabilities: number(), descendantScopes: number(), navigationAffected: boolean() });
export const capabilityDependency = strictObject({ capabilityId: text, name: text, healthy: boolean(), reason: union([capabilityDisabledReason, nullSchema()]) });
export const capabilityAssignment = strictObject({
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
export const roleTemplateCode = literal(ACCESS_ROLE_TEMPLATE_CODES);
export const roleTemplate = strictObject({ code: roleTemplateCode, name: text, description: text, allows: array(text), denies: array(text), version: number() });
export const accessRole = strictObject({
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
