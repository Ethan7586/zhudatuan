import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { accessOperations } from '../03_application_yingyong/AccessOperations';

describe('access scope management boundary', () => {
  it('reads scoped identity assignments and authoritative effective permissions without a reserved alias', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(centerRequest())).resolves.toMatchObject({ status: 200 });
    const query = harness.queries.find((text) => text.includes('from access.membership membership'));
    expect(query).toContain('from access.scopegrant scopegrant');
    expect(query).toContain('assignment.assigned_scope_id');
    expect(query).toContain("coalesce(assignment.scope_source,'inherited')");
    expect(query).toContain('access.resolve_membership(membership.id)');
    expect(query).toContain('from organization.unitclosure boundary');
    expect(query).toContain('boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id');
    expect(query).not.toContain('membership.organization_id=$1');
    expect(query).not.toMatch(/\baccess\.scopegrant\s+grant\b/);
  });

  it('returns the current-scope role directory with permissions, governance metadata, member count and version', async () => {
    const role = { id: 'role:finance', name: '财务', status: 'active', version: 4,
      permissions: ['finance.overview.read', 'order.read'], member_count: 3, governance: false, editable: true };
    const harness = operationHarness({ roleRows: [role] });

    const response = await accessOperations(context(harness.pool)).invoke(centerRequest());

    expect(response).toMatchObject({ status: 200, body: { roles: [role] } });
    const query = harness.queries.find((text) => text.includes('from access.role role where role.scope_id=$1'));
    expect(query).toContain("mapping.effect='allow'");
    expect(query).toContain('count(distinct assignment.membership_id)');
  });

  it('replaces only allow mappings so an identity rename or permission save preserves explicit denies', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(roleRequest())).resolves.toMatchObject({ status: 200 });

    const query = harness.queries.find((text) => text.includes('insert into access.role(id,scope_id,name,status,version)'));
    expect(query).toContain("mapping.effect='allow'");
    expect(query).not.toContain("mapping.effect='deny'");
  });

  it('raises and returns Access Version for every member affected by an identity save', async () => {
    const harness = operationHarness();

    const response = await accessOperations(context(harness.pool)).invoke(roleRequest());

    expect(response).toMatchObject({ body: { affected_memberships: [
      { membership: 'membership:target', access_version: 3 },
    ] } });
    const versionWrite = harness.calls.find(({ text }) => text.startsWith('update access.membership membership')
      && text.includes('assignment.role_id=$1'));
    expect(versionWrite?.values).toEqual(['role:finance']);
  });

  it('rejects adding operator-only Permissions to a role already attached to storefront Memberships', async () => {
    const harness = operationHarness({ targetClient: 'storefront' });

    await expect(accessOperations(context(harness.pool)).invoke(roleRequest()))
      .rejects.toThrow('MANAGEMENT_PERMISSION_TARGET_NOT_ACTIVE_OPERATOR');

    expect(harness.queries.some((query) => query.includes('insert into access.role(id,scope_id,name,status,version)'))).toBe(false);
    expect(harness.queries.some((query) => query.includes('insert into access.rolepermission'))).toBe(false);
  });

  it('assigns a custom identity with a directly specified scope and raises Access Version once', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    const response = await accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'direct', mallA));

    expect(response).toMatchObject({ status: 200, body: { action: 'assign', changed: true,
      role: 'role:finance', membership: 'membership:target', scope_source: 'direct', access_version: 3 } });
    const assignment = harness.calls.find(({ text }) => text.includes('insert into access.membershiprole'));
    expect(assignment?.values.slice(0, 7)).toEqual([
      'membership:target', 'role:finance', 'membership:manager', 'mall', mallA.id,
      'organization-platform-root/tenant-a/mall-a', 'direct',
    ]);
    expect(harness.queries.filter((query) => query.startsWith('update access.membership set access_version')).length).toBe(1);
  });

  it('rejects a management role for a storefront membership before writing role or scope state', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA, targetClient: 'storefront' });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'direct', mallA)))
      .rejects.toThrow('MANAGEMENT_PERMISSION_TARGET_NOT_ACTIVE_OPERATOR');

    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
    expect(harness.queries.some((query) => /update access\.membership set (client|realm_id|organization_id|node_id|parent_node_id)/.test(query))).toBe(false);
  });

  it('keeps a storefront business role assignable when it has no operator-only permission', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA,
      targetClient: 'storefront', managementRole: false });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'direct', mallA)))
      .resolves.toMatchObject({ status: 200, body: { changed: true } });
  });

  it('rejects a management role across Realms without leaving a partial grant', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA, targetRealm: 'realm:other' });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'direct', mallA)))
      .rejects.toThrow('MANAGEMENT_PERMISSION_REALM_MISMATCH');

    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('inherits an existing scope without creating a duplicate grant', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'inherited', mallA)))
      .resolves.toMatchObject({ body: { scope_source: 'inherited', access_version: 3 } });

    expect(harness.queries.some((query) => query.includes('select id from access.scopegrant'))).toBe(true);
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('does not assign the same identity outside the target member hierarchy', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantB });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('assign', 'direct', mallA)))
      .rejects.toThrow('MANAGEMENT_PERMISSION_ORGANIZATION_MISMATCH');

    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('revokes only the selected identity relation and leaves the member account and other identities untouched', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    await expect(accessOperations(context(harness.pool)).invoke(assignmentRequest('revoke', 'direct', mallA)))
      .resolves.toMatchObject({ body: { action: 'revoke', changed: true, access_version: 3 } });

    const revoke = harness.queries.find((query) => query.startsWith('update access.membershiprole assignment'));
    expect(revoke).toContain('assignment.role_id=$2');
    expect(revoke).toContain('assignment.assigned_scope_id=$3');
    expect(harness.queries.some((query) => /delete from (access\.)?membership\b/.test(query))).toBe(false);
    expect(harness.queries.some((query) => query.includes('delete from access.membershiprole'))).toBe(false);
  });

  it('lets the authoritative Owner principal promote an active operator through the ancestor senior role without touching storefront membership', async () => {
    const harness = operationHarness({ scope: tenantA, targetMembershipScope: mallA, seniorRole: true });

    const response = await accessOperations(context(harness.pool)).invoke(seniorAssignmentRequest('assign', projectedOwnerAccess(mallA)));

    expect(response).toMatchObject({ status: 200, body: { action: 'assign', changed: true,
      role: 'role-senior-administrator-v1:tenant-a', membership: 'membership:target',
      scope_source: 'direct', access_version: 3 } });
    expect(harness.queries.some((query) => query.includes("roleboundary.ancestor_id=role.scope_id"))).toBe(true);
    expect(harness.calls.find(({ text }) => text.includes('insert into access.membershiprole'))?.values.slice(0, 7)).toEqual([
      'membership:target', 'role-senior-administrator-v1:tenant-a', 'membership:manager', 'tenant', tenantA.id,
      'organization-platform-root/tenant-a', 'direct',
    ]);
    expect(harness.calls.find(({ text }) => text.includes('set operator_display_name=case'))?.values)
      .toEqual(['membership:target', '高级管理员']);
    expect(harness.queries.some((query) => /delete from access\.membership\b/.test(query))).toBe(false);
  });

  it('lets the authoritative Owner principal demote a senior administrator and retires only its unused senior Scope', async () => {
    const harness = operationHarness({ scope: tenantA, targetMembershipScope: mallA, seniorRole: true,
      revokedSeniorScope: true });

    const response = await accessOperations(context(harness.pool)).invoke(seniorAssignmentRequest('revoke', projectedOwnerAccess(mallA)));

    expect(response).toMatchObject({ status: 200, body: { action: 'revoke', changed: true,
      role: 'role-senior-administrator-v1:tenant-a', access_version: 3 } });
    const scopeRevoke = harness.queries.find((query) => query.startsWith('update access.scopegrant scopegrant'));
    expect(scopeRevoke).toContain('not exists(select 1 from access.membershiprole assignment');
    expect(harness.calls.find(({ text }) => text.includes('set operator_display_name=case'))?.values)
      .toEqual(['membership:target', '管理员']);
    expect(harness.queries.some((query) => /delete from (access\.)?membership\b/.test(query))).toBe(false);
  });

  it('rejects senior role changes by a non-Owner before any database write', async () => {
    const harness = operationHarness({ scope: tenantA, targetMembershipScope: mallA, seniorRole: true });

    await expect(accessOperations(context(harness.pool)).invoke(seniorAssignmentRequest('assign', accessContext(mallA, platform))))
      .rejects.toThrow('OWNER_REQUIRED_FOR_SENIOR_ADMINISTRATOR');
    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
  });

  it('keeps the unique Owner immutable during senior role scheduling', async () => {
    const harness = operationHarness({ scope: tenantA, targetMembershipScope: mallA, seniorRole: true, targetIsOwner: true });

    await expect(accessOperations(context(harness.pool)).invoke(seniorAssignmentRequest('assign')))
      .rejects.toThrow('OWNER_ROLE_LEVEL_IMMUTABLE');
    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
  });

  it('deletes a custom identity only after detaching its relations and preserves member rows', async () => {
    const harness = operationHarness();

    const response = await accessOperations(context(harness.pool)).invoke(deleteRoleRequest());

    expect(response).toMatchObject({ body: { action: 'delete', deleted: true, role: 'role:finance',
      affected_memberships: [{ membership: 'membership:target', access_version: 3 }] } });
    const relationDelete = harness.queries.findIndex((query) => query.startsWith('delete from access.membershiprole'));
    const roleDelete = harness.queries.findIndex((query) => query.startsWith('delete from access.role where'));
    expect(relationDelete).toBeGreaterThan(-1);
    expect(roleDelete).toBeGreaterThan(relationDelete);
    expect(harness.queries.some((query) => /^delete from access\.membership where/.test(query))).toBe(false);
  });

  it('fails closed when a runtime request attempts to create an unsupported deny scope', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('deny')))
      .rejects.toThrow('SCOPE_DENY_UNSUPPORTED');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('rejects a management Scope for a storefront Membership before any write', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA, targetClient: 'storefront' });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallA.id, ownerAccess(mallA))))
      .rejects.toThrow('MANAGEMENT_PERMISSION_TARGET_NOT_ACTIVE_OPERATOR');

    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
    expect(harness.queries.some((query) => query.startsWith('update access.membership'))).toBe(false);
  });

  it('lets a platform Owner grant a mall through the canonical authorization hierarchy', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallA.id, ownerAccess(mallA))))
      .resolves.toMatchObject({ status: 200 });
    const insertion = harness.calls.find(({ text }) => text.includes('insert into access.scopegrant'));
    expect(insertion?.values.slice(1, 7)).toEqual([
      'membership:target', 'mall', mallA.id, 'organization-platform-root/tenant-a/mall-a', 'allow', null,
    ]);
  });

  it('keeps partner grants valid when the target membership belongs to the partner ancestor tree', async () => {
    const harness = operationHarness({ scope: supplierA, targetMembershipScope: mallA });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'supplier', supplierA.id,
      accessContext(supplierA, mallA)))).resolves.toMatchObject({ status: 200 });
    const insertion = harness.calls.find(({ text }) => text.includes('insert into access.scopegrant'));
    expect(insertion?.values.slice(1, 7)).toEqual([
      'membership:target', 'supplier', supplierA.id,
      'organization-platform-root/tenant-a/mall-a/supplier-a', 'allow', null,
    ]);
  });

  it('rejects a canonical target from an unrelated tenant tree', async () => {
    const harness = operationHarness({ scope: mallB, targetMembershipScope: tenantB });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallB.id, tenantManagerAccess(mallB))))
      .rejects.toThrow('CANNOT_GRANT_UNOWNED_SCOPE');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('rejects a caller-provided kind that differs from the canonical scope kind', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'tenant', mallA.id, ownerAccess(mallA))))
      .rejects.toThrow('CANNOT_GRANT_UNOWNED_SCOPE');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('rejects a scope hint whose canonical scope differs from the requested grant', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantA });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallA.id,
      ownerAccess(platform)))).rejects.toThrow('CANNOT_GRANT_UNOWNED_SCOPE');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('rejects an otherwise owned scope for a membership in an unrelated tree', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantB });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallA.id, ownerAccess(mallA))))
      .rejects.toThrow('MANAGEMENT_PERMISSION_ORGANIZATION_MISMATCH');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
  });

  it('rejects a management Scope whose governance organization differs from the operator Membership', async () => {
    const harness = operationHarness({ scope: mallA, targetMembershipScope: tenantB });

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('allow', 'mall', mallA.id, ownerAccess(mallA))))
      .rejects.toThrow('MANAGEMENT_PERMISSION_ORGANIZATION_MISMATCH');

    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
    expect(harness.queries.some((query) => query.includes('insert into access.membershiprole'))).toBe(false);
  });
});

const platform = { kind: 'platform' as const, id: 'organization-platform-root', path: [] };
const tenantA = { kind: 'tenant' as const, id: 'tenant-a', tenant: 'tenant-a', path: [
  { kind: 'platform' as const, id: platform.id },
] };
const mallA = { kind: 'mall' as const, id: 'mall-a', tenant: tenantA.id, path: [
  { kind: 'platform' as const, id: platform.id }, { kind: 'tenant' as const, id: tenantA.id },
] };
const supplierA = { kind: 'supplier' as const, id: 'supplier-a', tenant: tenantA.id, path: [
  { kind: 'platform' as const, id: platform.id }, { kind: 'tenant' as const, id: tenantA.id },
  { kind: 'mall' as const, id: mallA.id },
] };
const tenantB = { kind: 'tenant' as const, id: 'tenant-b', tenant: 'tenant-b', path: [
  { kind: 'platform' as const, id: platform.id },
] };
const mallB = { kind: 'mall' as const, id: 'mall-b', tenant: tenantB.id, path: [
  { kind: 'platform' as const, id: platform.id }, { kind: 'tenant' as const, id: tenantB.id },
] };
const managerTenant = { kind: 'tenant' as const, id: 'tenant-zhudatuan', tenant: 'tenant-zhudatuan', path: [
  { kind: 'platform' as const, id: platform.id },
] };

function centerRequest(): OperationRequest {
  return {
    type: 'access.center.read',
    access: managerAccess(),
    input: {
      path: {}, query: {}, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  };
}

function scopeRequest(effect: string, kind = 'mall', scope = 'mall-zhudatuan', access = managerAccess()): OperationRequest {
  return {
    type: 'access.scopes.manage',
    access,
    input: {
      path: { membershipid: 'membership:target' }, query: {}, headers: {},
      body: { kind, scope, effect }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'scope-management:deny',
    },
  };
}

function roleRequest(): OperationRequest {
  return {
    type: 'access.roles.manage', access: managerAccess(),
    input: {
      path: { roleid: 'role:finance' }, query: {}, headers: {},
      body: { name: '财务主管', permissions: ['finance.overview.read', 'order.read'] }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'role-management:rename', expectedVersion: 3,
    },
  };
}

function assignmentRequest(action: 'assign' | 'revoke', scopeSource: 'direct' | 'inherited', scope: AccessContext['scope']): OperationRequest {
  return {
    type: 'access.roles.manage', access: ownerAccess(scope),
    input: {
      path: { roleid: 'role:finance' }, query: {}, headers: {},
      body: { action, membership: 'membership:target', kind: scope.kind, scope: scope.id, scopeSource }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: `role-assignment:${action}:${scopeSource}`, expectedVersion: 2,
    },
  };
}

function seniorAssignmentRequest(action: 'assign' | 'revoke', access: AccessContext = ownerAccess(mallA)): OperationRequest {
  return {
    type: 'access.roles.manage', access,
    input: {
      path: { roleid: 'role-senior-administrator-v1:tenant-a' }, query: {}, headers: {},
      body: { action, membership: 'membership:target', kind: 'tenant', scope: tenantA.id, scopeSource: 'direct' }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: `senior-role:${action}`, expectedVersion: 2,
    },
  };
}

function deleteRoleRequest(): OperationRequest {
  return {
    type: 'access.roles.manage', access: managerAccess(),
    input: {
      path: { roleid: 'role:finance' }, query: {}, headers: {}, body: { action: 'delete' }, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'role-delete:finance', expectedVersion: 3,
    },
  };
}

function ownerAccess(scope: AccessContext['scope']): AccessContext {
  const access = accessContext(scope, platform);
  return { ...access, governance: { governanceLevel: 'owner', isExactOwner: true,
    actorMembershipId: access.membership.id, actorPrincipalId: access.actor.id,
    organizationId: tenantA.id, ownerMembershipId: access.membership.id,
    scope: { kind: 'tenant', semanticId: tenantA.id, storageId: tenantA.id, organizationId: tenantA.id },
    resolvedAt: new Date('2026-09-01T00:00:00.000Z') } };
}

function projectedOwnerAccess(scope: AccessContext['scope']): AccessContext {
  const access = ownerAccess(scope);
  return { ...access, governance: { ...access.governance!, isExactOwner: false,
    ownerMembershipId: 'membership:authoritative-owner' } };
}

function tenantManagerAccess(scope: AccessContext['scope']): AccessContext {
  return accessContext(scope, tenantA);
}

function managerAccess(): AccessContext {
  const scope = { kind: 'mall' as const, id: 'mall-zhudatuan', tenant: managerTenant.id, path: [] };
  return accessContext(scope);
}

function accessContext(scope: AccessContext['scope'], grantScope = scope): AccessContext {
  return {
    actor: { id: 'principal:manager', session: 'session:manager', membership: 'membership:manager', credentialVersion: 1,
      accessVersion: 2, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:manager', active: true, accessVersion: 2, denies: [], grants: [{
      scope: grantScope, permissions: ['access.scope.manage'], effective: '2026-08-29T00:00:00.000Z', expires: null,
    }] },
    scope, accessVersion: 2, capabilities: ['access.scopes.manage'], assurance: { level: 2 }, trace: 'trace:scope-deny',
  };
}

function operationHarness(options: Readonly<{ scope?: unknown; targetMembershipScope?: unknown;
  assignedTargetMembershipScope?: unknown;
  targetClient?: string; targetStatus?: string; targetRealm?: string; actorRealm?: string;
  targetRealmBinding?: boolean; targetOrganizationBinding?: boolean; managementRole?: boolean;
  seniorRole?: boolean; targetIsOwner?: boolean; revokedSeniorScope?: boolean;
  roleRows?: readonly Record<string, unknown>[] }> = {}): Readonly<{
  pool: DatabasePool;
  queries: readonly string[];
  calls: readonly Readonly<{ text: string; values: readonly unknown[] }>[];
}> {
  let requestHash = '';
  const queries: string[] = [];
  const calls: { text: string; values: readonly unknown[] }[] = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push(text);
      calls.push({ text, values });
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return result([{}]);
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.startsWith('select access.scope_object($1) scope')) {
        const target = { target_membership_id: 'membership:target', target_client: options.targetClient ?? 'operator',
          target_status: options.targetStatus ?? 'active', target_realm_id: options.targetRealm ?? 'realm:tenant-a',
          actor_realm_id: options.actorRealm ?? 'realm:tenant-a', target_realm_binding: options.targetRealmBinding ?? true,
          target_organization_binding: options.targetOrganizationBinding ?? true };
        if (text.includes('target.access_version target_access_version')) return result([{ ...target, scope: options.scope ?? mallA,
          target_membership_scope: options.targetMembershipScope ?? tenantA, target_access_version: 2,
          role_id: options.seniorRole ? 'role-senior-administrator-v1:tenant-a' : 'role:finance',
          senior_role: options.seniorRole ?? false, target_is_owner: options.targetIsOwner ?? false,
          management_role: options.managementRole ?? true }]);
        return result([{ ...target, scope: options.scope ?? null, target_membership_scope: options.targetMembershipScope ?? null }]);
      }
      if (text.includes('permission.code=any($2::text[])') && text.includes('from access.membershiprole assignment')) {
        return result([{ target_membership_id: 'membership:target', target_client: options.targetClient ?? 'operator',
          target_status: options.targetStatus ?? 'active', target_realm_id: options.targetRealm ?? 'realm:tenant-a',
          actor_realm_id: options.actorRealm ?? 'realm:tenant-a',
          target_membership_scope: options.assignedTargetMembershipScope ?? managerTenant,
          target_realm_binding: options.targetRealmBinding ?? true,
          target_organization_binding: options.targetOrganizationBinding ?? true }]);
      }
      if (text.includes('from access.role role where role.scope_id=$1')) return result(options.roleRows ?? []);
      if (text.includes('insert into access.role(id,scope_id,name,status,version)')) {
        return result([{ id: 'role:finance', name: '财务主管', status: 'active', version: 4 }]);
      }
      if (text.includes('select id from access.scopegrant')) return result([{ id: 'scope:inherited' }]);
      if (text.includes('insert into access.scopegrant')) return result([{ id: 'scope:new', access_version: 3 }]);
      if (text.includes('insert into access.membershiprole')) return result([{ role_id: options.seniorRole ? 'role-senior-administrator-v1:tenant-a' : 'role:finance' }]);
      if (text.startsWith('update access.membershiprole assignment')) return result([{ scope_source: 'direct' }]);
      if (text.startsWith('update access.scopegrant scopegrant')) return result(options.revokedSeniorScope ? [{ id: 'scope:senior' }] : []);
      if (text.startsWith('update access.membership') && text.includes('set access_version=')) {
        if (text.includes('id=any') || text.includes('assignment.role_id=$1')) {
          return result([{ id: 'membership:target', access_version: 3 }]);
        }
        return result([{ access_version: 3 }]);
      }
      if (text.startsWith('select id,name,version from access.role')) return result([{ id: 'role:finance', name: '财务', version: 3 }]);
      if (text.startsWith('delete from access.membershiprole')) return result([{ membership_id: 'membership:target' }]);
      if (text.startsWith('delete from access.role where')) return result([{ id: 'role:finance', name: '财务' }]);
      return result([]);
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async () => result([]),
    workload: () => pool,
    end: async () => undefined,
  };
  return { pool, queries, calls };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
  return { container } as unknown as ModuleContext;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
