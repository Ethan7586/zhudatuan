import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { RISK_GATE } from '../../../foundation/security/RiskGate';
import { identityOperations, identityRegistrationOperations } from '../05_interface_jieru/http/IdentityOperations';
import { RETURN_TARGETS } from '../04_adapters_shixian/providers_waibu/ReturnTargetCatalog';

describe('operator invitation security boundary', () => {
  it('creates only a phone-bound, single-use pending operator invitation in the actor tenant', async () => {
    const harness = invitationHarness();

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(managerAccess()));

    expect(response).toMatchObject({ status: 201, body: { target: 'console', max_uses: 1 } });
    expect(response.body).toMatchObject({ governanceLevel: 'administrator' });
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[1]).toBe('tenant-zhudatuan');
    expect(inserted?.values[7]).toBe('role-zhudatuan-pending-operator');
    expect(inserted?.values[3]).toBe(inserted?.values[8]);
    expect(inserted?.values[9]).toBe(1);
    expect(inserted?.values[12]).toBe('operator');
    expect(inserted?.values[13]).toBe('mall-zhudatuan');
    const roleLookup = harness.queries.find(({ text }) => text.includes('pendingpermission'));
    expect(roleLookup?.text).toContain('not exists');
  });

  it('persists an exact-owner senior administrator invitation with the tenant-scoped formal role', async () => {
    const harness = invitationHarness();

    const response = await identityRegistrationOperations(context(harness.pool))
      .invoke(createRequest(managerAccess(), undefined, undefined, 'senior_administrator'));

    expect(response).toMatchObject({ status: 201, body: { governanceLevel: 'senior_administrator' } });
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[7]).toBe('role-senior-administrator-v1:tenant-zhudatuan');
    const roleLookup = harness.queries.find(({ text }) => text.includes('select role.id'));
    expect(roleLookup?.values).toEqual([
      'role-senior-administrator-v1:tenant-zhudatuan', 'tenant-zhudatuan', 'senior_administrator',
    ]);
  });

  it('rejects a senior administrator creating a senior administrator invitation', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:senior-administrator', membership: 'membership:senior-administrator',
      isExactOwner: false, governanceLevel: 'senior_administrator',
    });

    await expect(identityRegistrationOperations(context(harness.pool))
      .invoke(createRequest(access, undefined, undefined, 'senior_administrator')))
      .resolves.toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });

    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('rejects unknown governance levels instead of inferring a role from the label', async () => {
    const harness = invitationHarness();
    const base = createRequest(managerAccess());
    const request: OperationRequest = { ...base, input: {
      ...base.input,
      body: { ...(base.input.body as Readonly<Record<string, unknown>>), governanceLevel: '高级管理员' },
    } };

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(request))
      .rejects.toThrow('INVALID_INVITATION_INPUT');
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('accepts platform scope and narrows creation to the selected authorized tenant', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ scope: { kind: 'platform', id: 'organization-platform-root', path: [] } });

    const response = await identityOperations(context(harness.pool))
      .invoke(createRequest(access, 'operator', 'tenant-zhudatuan'));

    expect(response).toMatchObject({ status: 201, body: { target: 'console' } });
    const targetLookup = harness.queries.find(({ text }) => text.includes("organization.kind='tenant'"));
    expect(targetLookup?.values).toEqual(['tenant-zhudatuan']);
    const scopeNarrowing = harness.queries.find(({ text, values }) => text.includes("set_config('app.scope_id'") && values.length === 1);
    expect(scopeNarrowing?.values).toEqual(['tenant-zhudatuan']);
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[1]).toBe('tenant-zhudatuan');
  });

  it('fails closed when the authenticated membership lacks the invitation capability', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ capabilities: [] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('rejects a non-owner even when a stale grant still advertises the permission and capability', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({ actor: 'principal:legacy-manager', membership: 'membership:legacy-manager', isExactOwner: false });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('keeps full-runtime operator invitation creation unavailable to an ordinary administrator', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({ actor: 'principal:tenant-manager', membership: 'membership:tenant-manager', isExactOwner: false });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access, 'operator'));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('lets a senior administrator create an operator invitation in full runtime', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:senior-administrator', membership: 'membership:senior-administrator',
      isExactOwner: false, governanceLevel: 'senior_administrator',
    });

    const response = await identityOperations(context(harness.pool))
      .invoke(createRequest(access, 'operator', undefined, 'administrator'));

    expect(response).toMatchObject({ status: 201, body: { target: 'console', governanceLevel: 'administrator' } });
  });

  it('creates a consumable storefront invitation with the canonical storefront role in full runtime', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ scope: mallScope() });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target: 'storefront' } });
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[1]).toBe('mall-zhudatuan');
    expect(inserted?.values[7]).toBe('role-zhudatuan-storefront-member');
    expect(inserted?.values[12]).toBe('storefront');
  });

  it('creates a storefront invitation with the independent role owned by a provisioned Mall', async () => {
    const harness = invitationHarness();
    const provisionedMall = 'mall:provisioned-l1';
    const access = managerAccess({
      scope: { kind: 'mall', id: provisionedMall, tenant: 'tenant-zhudatuan', path: [] },
    });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target: 'storefront' } });
    const lookup = harness.queries.find(({ text }) => text.includes('select role.id'));
    expect(lookup?.values).toEqual([
      `role-zhudatuan-storefront-member:${provisionedMall}`,
      provisionedMall,
      null,
    ]);
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[1]).toBe(provisionedMall);
    expect(inserted?.values[7]).toBe(`role-zhudatuan-storefront-member:${provisionedMall}`);
  });

  it('lets a senior administrator create storefront invitations through the same invitation model', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:senior-administrator', membership: 'membership:senior-administrator',
      scope: mallScope(), isExactOwner: false, governanceLevel: 'senior_administrator',
    });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target: 'storefront' } });
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[7]).toBe('role-zhudatuan-storefront-member');
    expect(access.governance).toMatchObject({ governanceLevel: 'senior_administrator', isExactOwner: false });
  });

  it('rejects storefront invitations from an ordinary administrator even with a stale invitation grant', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:administrator', membership: 'membership:administrator',
      scope: mallScope(), isExactOwner: false, governanceLevel: 'administrator',
    });

    await expect(identityOperations(context(harness.pool)).invoke(createRequest(access)))
      .resolves.toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('rejects storefront creation outside a mall scope before generating an invitation', async () => {
    const harness = invitationHarness();

    await expect(identityOperations(context(harness.pool)).invoke(createRequest(managerAccess())))
      .rejects.toThrow('INVITATION_SCOPE_INVALID');
    expect(harness.queries.some(({ text }) => text.includes('select role.id'))).toBe(false);
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('rejects a non-canonical or wrong-scope storefront role without returning an invitation code', async () => {
    const harness = invitationHarness({ roleRows: [{ id: 'role-mall-admin' }] });

    await expect(identityOperations(context(harness.pool)).invoke(createRequest(managerAccess({ scope: mallScope() }))))
      .rejects.toThrow('EMPLOYEE_ROLE_NOT_FOUND');
    const lookup = harness.queries.find(({ text }) => text.includes('select role.id'));
    expect(lookup?.text).toContain('role.scope_id=$2');
    expect(lookup?.text).toContain("$3::text is distinct from 'administrator'");
    expect(lookup?.values).toEqual(['role-zhudatuan-storefront-member', 'mall-zhudatuan', null]);
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('revokes a storefront invitation in the authorized full-runtime scope', async () => {
    const harness = invitationHarness({ revokeRows: [{
      id: 'invite:storefront', label: '商城邀请', target_client: 'storefront', max_uses: 10, use_count: 0,
      status: 'disabled', version: 1,
    }] });
    const access = managerAccess({ capabilities: ['identity.invitations.revoke'], scope: mallScope() });

    const response = await identityOperations(context(harness.pool)).invoke(revokeRequest(access));

    expect(response).toMatchObject({ status: 200, body: { id: 'invite:storefront', status: 'disabled', version: 1 } });
    const updated = harness.queries.find(({ text }) => text.includes("update member.invite set status='disabled'"));
    expect(updated?.text).toContain('access.scope_allowed(organization_id)');
    expect(updated?.values[2]).toBe(false);
  });

  it('does not fake success when a scoped storefront invitation was not updated', async () => {
    const harness = invitationHarness({ currentRows: [{ status: 'active', version: 0 }] });
    const access = managerAccess({ capabilities: ['identity.invitations.revoke'], scope: mallScope() });

    await expect(identityOperations(context(harness.pool)).invoke(revokeRequest(access)))
      .rejects.toThrow('VERSION_CONFLICT');
  });

  it('fails closed for an unauthorized or out-of-scope storefront revoke', async () => {
    const unauthorized = invitationHarness();
    const denied = managerAccess({ capabilities: [], scope: mallScope() });
    await expect(identityOperations(context(unauthorized.pool)).invoke(revokeRequest(denied)))
      .resolves.toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(unauthorized.queries.some(({ text }) => text.includes("update member.invite set status='disabled'"))).toBe(false);

    const outOfScope = invitationHarness();
    const wrongScope = managerAccess({ capabilities: ['identity.invitations.revoke'], scope: {
      kind: 'mall', id: 'mall-demo', tenant: 'tenant-demo', path: [],
    } });
    await expect(identityOperations(context(outOfScope.pool)).invoke(revokeRequest(wrongScope)))
      .rejects.toThrow('INVITATION_NOT_FOUND');
  });

  it('keeps registration-only revoke constrained to operator invitations in the fixed tenant', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ capabilities: ['identity.invitations.revoke'] });

    await expect(identityRegistrationOperations(context(harness.pool)).invoke(revokeRequest(access)))
      .rejects.toThrow('INVITATION_NOT_FOUND');
    const updated = harness.queries.find(({ text }) => text.includes("update member.invite set status='disabled'"));
    expect(updated?.text).toContain("target_client='operator' and organization_id='tenant-zhudatuan'");
    expect(updated?.values[2]).toBe(true);
  });

  it('keeps full-runtime operator invitation revoke unavailable to an ordinary administrator', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:tenant-manager', membership: 'membership:tenant-manager',
      capabilities: ['identity.invitations.revoke'], isExactOwner: false,
    });

    await expect(identityOperations(context(harness.pool)).invoke(revokeRequest(access)))
      .resolves.toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes("update member.invite set status='disabled'"))).toBe(false);
  });

  it('lets a senior administrator revoke an operator invitation', async () => {
    const harness = invitationHarness({ revokeRows: [{ id: 'invite:storefront', status: 'disabled', version: 2 }] });
    const access = managerAccess({
      actor: 'principal:senior-administrator', membership: 'membership:senior-administrator',
      capabilities: ['identity.invitations.revoke'], isExactOwner: false,
      governanceLevel: 'senior_administrator',
    });

    const response = await identityOperations(context(harness.pool)).invoke(revokeRequest(access));

    expect(response).toMatchObject({ status: 200, body: { status: 'disabled' } });
    const updated = harness.queries.find(({ text }) => text.includes("update member.invite set status='disabled'"));
    expect(updated?.values[3]).toBe(true);
  });

  it('lets a transferred owner mint operator invitations without matching any fixed principal string', async () => {
    const harness = invitationHarness({ exactOwner: true });
    const access = managerAccess({ actor: 'principal:successor-owner', membership: 'membership:successor-owner' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target: 'console' } });
    expect(harness.queries.some(({ text }) => text.includes('access.zhudatuan_invitation_owner'))).toBe(false);
  });
});

function createRequest(access: AccessContext, targetClient?: 'storefront' | 'operator', tenantId?: string,
  governanceLevel?: 'administrator' | 'senior_administrator'): OperationRequest {
  return {
    type: 'identity.invitations.create',
    access,
    input: {
      path: {}, query: {}, headers: {},
      body: { label: '普通管理员邀请', destination: '+8613800138000', maxUses: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(), ...(targetClient === undefined ? {} : { targetClient }),
        ...(tenantId === undefined ? {} : { tenantId }),
        ...(governanceLevel === undefined ? {} : { governanceLevel }) },
      rawBody: '', deadline: Date.now() + 5_000, signal: new AbortController().signal,
      idempotency: 'operator-invitation:create',
    },
  };
}

function revokeRequest(access: AccessContext): OperationRequest {
  return {
    type: 'identity.invitations.revoke',
    access,
    input: {
      path: { invitationid: 'invite:storefront' }, query: {}, headers: {},
      body: { reason: '撤销错误邀请' }, rawBody: '', deadline: Date.now() + 5_000,
      signal: new AbortController().signal, idempotency: 'storefront-invitation:revoke',
    },
  };
}

function managerAccess(overrides: Readonly<{
  capabilities?: readonly string[];
  actor?: string;
  membership?: string;
  isExactOwner?: boolean;
  governanceLevel?: 'owner' | 'senior_administrator' | 'administrator';
  scope?: AccessContext['scope'];
}> = {}): AccessContext {
  const scope = overrides.scope ?? { kind: 'tenant' as const, id: 'tenant-zhudatuan', tenant: 'tenant-zhudatuan', path: [] };
  const membership = overrides.membership ?? 'membership-platform-owner-ethan-v1';
  return {
    actor: { id: overrides.actor ?? 'principal:zhudatuan:owner:ethan:v1', session: 'session:owner', membership, credentialVersion: 1,
      accessVersion: 1, target: 'console', assurance: { level: 2 } },
    membership: { id: membership, active: true, accessVersion: 1, denies: [], grants: [{
      scope, permissions: ['identity.invitation.manage'], effective: '2026-08-29T00:00:00.000Z', expires: null,
    }] },
    governance: {
      governanceLevel: overrides.governanceLevel ?? (overrides.isExactOwner === false ? 'administrator' : 'owner'),
      isExactOwner: overrides.isExactOwner !== false,
      actorMembershipId: membership,
      actorPrincipalId: overrides.actor ?? 'principal:zhudatuan:owner:ethan:v1',
      organizationId: scope.tenant ?? scope.id,
      ownerMembershipId: overrides.isExactOwner === false ? 'membership:current-owner' : membership,
      scope: { kind: scope.kind, semanticId: scope.id, storageId: scope.kind === 'self' ? `self:${scope.id}` : scope.id },
      resolvedAt: new Date('2026-09-02T00:00:00.000Z'),
    },
    scope, accessVersion: 1,
    capabilities: overrides.capabilities ?? ['identity.invitations.create'],
    assurance: { level: 2 }, trace: 'trace:owner-invitation',
  };
}

function mallScope(): AccessContext['scope'] {
  return { kind: 'mall', id: 'mall-zhudatuan', tenant: 'tenant-zhudatuan', path: [] };
}

function invitationHarness(options: Readonly<{
  revokeRows?: readonly Record<string, unknown>[];
  currentRows?: readonly Record<string, unknown>[];
  roleRows?: readonly Record<string, unknown>[];
  exactOwner?: boolean;
}> = {}): Readonly<{
  pool: DatabasePool;
  queries: ReadonlyArray<Readonly<{ text: string; values: readonly unknown[] }>>;
}> {
  let requestHash = '';
  const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.startsWith('select request_hash,state,response')) return result([{ request_hash: requestHash, state: 'started', response: null }]);
      if (text.includes('access.zhudatuan_invitation_owner') || text.includes('access.zhudatuan_owner_context')) {
        return result([{ exact_owner: options.exactOwner !== false }]);
      }
      if (text.includes("organization.kind='tenant'")) return result([{ id: String(values[0]) }]);
      if (text.includes('select storefront.id')) return result([{ id: 'mall-zhudatuan' }]);
      if (text.includes('select role.id')) return result(options.roleRows ?? [{ id: String(values[0]) }]);
      if (text.includes('select id,terms_hash from identity.registrationpolicy')) {
        return result([{ id: 'registration:zhudatuan:2026-08-28-v1', terms_hash: 'f'.repeat(64) }]);
      }
      if (text.includes('insert into member.invite')) return result([{
        id: String(values[0]), label: String(values[2]), target: values[12] === 'operator' ? 'console' : String(values[12]), max_uses: Number(values[9]), use_count: 0,
        status: 'active', version: 0,
      }]);
      if (text.includes("update member.invite set status='disabled'")) return result(options.revokeRows ?? []);
      if (text.includes('select status,version from member.invite')) return result(options.currentRows ?? []);
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
  return { pool, queries };
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
  container.bind(KMS_CLIENT, { encrypt: async () => ({ ciphertext: 'ciphertext', fingerprint: 'f'.repeat(64), keyVersion: 'v1' }) } as unknown as KmsClient);
  container.bind(RISK_GATE, { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) });
  container.bind(RETURN_TARGETS, {
    console: 'https://console.example.test', storefront: 'https://storefront.example.test',
    store: 'https://store.example.test', supplier: 'https://supplier.example.test',
  });
  return { container } as unknown as ModuleContext;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
