import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { identityOperations, identityRegistrationOperations } from './IdentityOperations';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';

describe('operator invitation security boundary', () => {
  it('creates only a phone-bound, single-use pending operator invitation in the actor tenant', async () => {
    const harness = invitationHarness();

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(managerAccess()));

    expect(response).toMatchObject({ status: 201, body: { target_client: 'operator', max_uses: 1 } });
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

  it('fails closed when the authenticated membership lacks the invitation capability', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ capabilities: [] });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('rejects a non-owner even when a stale grant still advertises the permission and capability', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({ actor: 'principal:legacy-manager', membership: 'membership:legacy-manager' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('keeps full-runtime operator invitation creation exact-owner-only', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({ actor: 'principal:tenant-manager', membership: 'membership:tenant-manager' });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access, 'operator'));

    expect(response).toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
    expect(harness.queries.some(({ text }) => text.includes('insert into member.invite'))).toBe(false);
  });

  it('creates a consumable storefront invitation with the canonical storefront role in full runtime', async () => {
    const harness = invitationHarness();
    const access = managerAccess({ scope: mallScope() });

    const response = await identityOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target_client: 'storefront' } });
    const inserted = harness.queries.find(({ text }) => text.includes('insert into member.invite'));
    expect(inserted?.values[1]).toBe('mall-zhudatuan');
    expect(inserted?.values[7]).toBe('role-zhudatuan-storefront-member');
    expect(inserted?.values[12]).toBe('storefront');
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
    expect(lookup?.values).toEqual(['role-zhudatuan-storefront-member', 'mall-zhudatuan']);
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

  it('keeps full-runtime operator invitation revoke exact-owner-only', async () => {
    const harness = invitationHarness({ exactOwner: false });
    const access = managerAccess({
      actor: 'principal:tenant-manager', membership: 'membership:tenant-manager',
      capabilities: ['identity.invitations.revoke'],
    });

    await expect(identityOperations(context(harness.pool)).invoke(revokeRequest(access)))
      .rejects.toThrow('INVITATION_NOT_FOUND');
    const updated = harness.queries.find(({ text }) => text.includes("update member.invite set status='disabled'"));
    expect(updated?.text).toContain("target_client<>'operator' or $4::boolean");
    expect(updated?.values[3]).toBe(false);
  });

  it('lets a transferred owner mint operator invitations without matching any fixed principal string', async () => {
    const harness = invitationHarness({ exactOwner: true });
    const access = managerAccess({ actor: 'principal:successor-owner', membership: 'membership:successor-owner' });

    const response = await identityRegistrationOperations(context(harness.pool)).invoke(createRequest(access));

    expect(response).toMatchObject({ status: 201, body: { target_client: 'operator' } });
    expect(harness.queries.some(({ text }) => text.includes('access.zhudatuan_invitation_owner'))).toBe(true);
  });
});

function createRequest(access: AccessContext, targetClient?: 'storefront' | 'operator'): OperationRequest {
  return {
    type: 'identity.invitations.create',
    access,
    input: {
      path: {}, query: {}, headers: {},
      body: { label: '普通管理员邀请', destination: '+8613800138000', maxUses: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(), ...(targetClient === undefined ? {} : { targetClient }) },
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
      if (text.includes('select storefront.id')) return result([{ id: 'mall-zhudatuan' }]);
      if (text.includes('select role.id')) return result(options.roleRows ?? [{ id: String(values[0]) }]);
      if (text.includes('select id,terms_hash from identity.registrationpolicy')) {
        return result([{ id: 'registration:zhudatuan:2026-08-28-v1', terms_hash: 'f'.repeat(64) }]);
      }
      if (text.includes('insert into member.invite')) return result([{
        id: String(values[0]), label: String(values[2]), target_client: String(values[12]), max_uses: Number(values[9]), use_count: 0,
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
