import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { accessOperations } from './AccessOperations';

describe('access scope management boundary', () => {
  it('uses a non-reserved scope-grant alias in the access center query', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(centerRequest())).resolves.toMatchObject({ status: 200 });
    const query = harness.queries.find((text) => text.includes('from access.membership membership'));
    expect(query).toContain('left join access.scopegrant scopegrant');
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

  it('fails closed when a runtime request attempts to create an unsupported deny scope', async () => {
    const harness = operationHarness();

    await expect(accessOperations(context(harness.pool)).invoke(scopeRequest('deny')))
      .rejects.toThrow('SCOPE_DENY_UNSUPPORTED');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
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
      .rejects.toThrow('CANNOT_GRANT_UNOWNED_SCOPE');
    expect(harness.queries.some((query) => query.includes('insert into access.scopegrant'))).toBe(false);
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

function ownerAccess(scope: AccessContext['scope']): AccessContext {
  return accessContext(scope, platform);
}

function tenantManagerAccess(scope: AccessContext['scope']): AccessContext {
  return accessContext(scope, tenantA);
}

function managerAccess(): AccessContext {
  const scope = { kind: 'mall' as const, id: 'mall-zhudatuan', tenant: 'tenant-zhudatuan', path: [] };
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

function operationHarness(options: Readonly<{ scope?: unknown; targetMembershipScope?: unknown; roleRows?: readonly Record<string, unknown>[] }> = {}): Readonly<{
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
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.startsWith('select access.scope_object($1) scope')) {
        return result([{ scope: options.scope ?? null, target_membership_scope: options.targetMembershipScope ?? null }]);
      }
      if (text.includes('from access.role role where role.scope_id=$1')) return result(options.roleRows ?? []);
      if (text.includes('insert into access.role(id,scope_id,name,status,version)')) {
        return result([{ id: 'role:finance', name: '财务主管', status: 'active', version: 4 }]);
      }
      if (text.includes('insert into access.scopegrant')) return result([{ id: 'scope:new', access_version: 3 }]);
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
