import { createHash } from 'node:crypto';
import { canonicalFinancialActionRequest } from '@shop/contract';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { RISK_GATE } from '../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from './application/port/WechatIdentity';
import { identityOperations } from './IdentityOperations';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';

describe('identity session projection', () => {
  it('returns the active member name without requiring a separate profile permission', async () => {
    const client = {
      query: async (text: string) => {
        if (text.includes('select rotated_at from identity.credential')) return result([{ rotated_at: null }]);
        if (text.includes('select display_name,mobile_ciphertext from member.profile')) {
          return result([{ display_name: '张三', mobile_ciphertext: 'ciphertext:mobile' }]);
        }
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

    const baseAccess = access();
    const response = await identityOperations(context(pool)).invoke({
      type: 'identity.session.read',
      access: { ...baseAccess, capabilities: ['identity.session.read'], governance: {
        ...baseAccess.governance!, governanceLevel: 'senior_administrator', isExactOwner: false,
        ownerMembershipId: 'membership:owner',
      } },
      input: {
        path: {}, query: {}, headers: {}, body: null, rawBody: '',
        deadline: Date.now() + 1_000, signal: new AbortController().signal,
      },
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        profile: { display_name: '张三', employee_no: null },
        security: { phoneMasked: '+86****8000' },
        governance: { level: 'senior_administrator', exactOwner: false, organization: 'organization:one' },
      },
    });
  });
});

describe('governance-aware member management', () => {
  it('lets a senior administrator manage an ordinary member through the canonical target resolver', async () => {
    const harness = memberManagementHarness('administrator');

    const response = await identityOperations(context(harness.pool)).invoke(
      memberStatusRequest(governanceAccess('senior_administrator', false))
    );

    expect(response).toMatchObject({ status: 200, body: { id: 'membership:target', status: 'suspended' } });
    const targetRead = harness.queries.find(({ text }) => text.includes('target_governance.governance_level'));
    expect(targetRead?.text).toContain('access.resolve_governance');
    expect(targetRead?.values).toEqual(['membership:target', 'tenant', 'tenant:one']);
  });

  it.each(['owner', 'senior_administrator'] as const)(
    'rejects a non-owner managing a protected %s membership',
    async (targetGovernance) => {
      const harness = memberManagementHarness(targetGovernance);

      await expect(identityOperations(context(harness.pool)).invoke(
        memberStatusRequest(governanceAccess('senior_administrator', false))
      )).resolves.toEqual({ status: 403, body: { code: 'PERMISSION_DENIED' } });
      expect(harness.queries.some(({ text }) => text.includes('set status=$2'))).toBe(false);
    }
  );

  it('preserves exact Owner authority over a senior administrator membership', async () => {
    const harness = memberManagementHarness('senior_administrator');

    const response = await identityOperations(context(harness.pool)).invoke(
      memberStatusRequest(governanceAccess('owner', true))
    );

    expect(response).toMatchObject({ status: 200, body: { id: 'membership:target', status: 'suspended' } });
  });
});

describe('identity financial action proof issuance', () => {
  it('binds the proof to the assurance created for this exact session and the canonical request hash', async () => {
    let storedHash = '';
    let assuranceId = '';
    let assuranceSession = '';
    let issueValues: readonly unknown[] | undefined;
    let persisted = '';
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) storedHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          return { rows: [{ request_hash: storedHash, state: 'started', response: null }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('update identity.challenge set consumed_at')) {
          return { rows: [{ principal_id: 'actor:one' }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('select mobile_ciphertext from member.profile')) {
          return { rows: [{ mobile_ciphertext: 'ciphertext:verified-mobile' }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('insert into identity.assurance')) {
          assuranceId = String(values[0]);
          assuranceSession = String(values[2]);
        }
        if (text.includes('update identity.session set assurance_level=3')) {
          return { rows: [{ id: 'session:one', assurance_level: 3 }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('access.issue_action_proof')) {
          issueValues = values;
          return {
            rows: [{ scope_id: 'organization:one', resource_id: 'settlement:one', expires_at: new Date('2026-08-28T04:00:00Z') }],
            rowCount: 1,
          } as unknown as QueryResult;
        }
        if (text.includes("update runtime.idempotency set state='completed'")) persisted = String(values[3]);
        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => client,
      query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      workload: () => pool,
      end: async () => undefined,
    };
    const target = {
      path: { settlementid: 'settlement:one' },
      query: { view: 'full' },
      body: { decision: 'approved', reason: 'verified' },
    };
    const requestHash = createHash('sha256')
      .update(canonicalFinancialActionRequest({ operation: 'finance.settlements.decide', ...target }))
      .digest('hex');
    const operations = identityOperations(context(pool));

    const result = await operations.invoke({
      type: 'identity.stepup.complete',
      access: access(),
      input: {
        path: {},
        query: {},
        headers: {},
        body: {
          challenge: 'challenge:one',
          code: '123456',
          action: {
            operation: 'finance.settlements.decide',
            resource: 'settlement:one',
            idempotencyKey: 'decision:one',
            expectedVersion: 7,
            requestHash,
            request: target,
          },
        },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'stepup:one',
      },
    });

    expect(result).toMatchObject({ status: 200, body: { actionProof: { requestHash } } });
    expect(assuranceId).toMatch(/^assurance:/);
    expect(assuranceSession).toBe('session:one');
    expect(issueValues).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/), 'actor:one', 'session:one', 'membership:one', assuranceId, 'finance.settlements.decide', 'settlement:one', 'decision:one', 7, requestHash]);
    expect(persisted).not.toContain(String((result.body as { actionProof: { proof: string } }).actionProof.proof));
  });
});

describe('administrator invitation issuance', () => {
  it('binds a new code to the tenant pending role and a separate storefront role', async () => {
    let requestHash = '';
    let invitationSql = '';
    let invitationValues: readonly unknown[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes('access.zhudatuan_owner_context')) return result([{ exact_owner: true }]);
        if (text.includes('select storefront.id')) return result([{ id: 'mall:one' }]);
        if (text.includes('select role.id')) return result([{ id: 'role-zhudatuan-pending-operator' }]);
        if (text.includes('from identity.registrationpolicy')) {
          return result([{ id: 'registration:v1', terms_hash: 'f'.repeat(64) }]);
        }
        if (text.includes('insert into member.invite')) {
          invitationSql = text;
          invitationValues = values;
          return result([
            {
              id: 'invite:one',
              label: '普通管理员邀请',
              target_client: 'operator',
              max_uses: 1,
              use_count: 0,
              starts_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 86_400_000).toISOString(),
              status: 'active',
              created_at: new Date().toISOString(),
              version: '0',
            },
          ]);
        }
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

    const response = await identityOperations(context(pool)).invoke({
      type: 'identity.invitations.create',
      access: { ...access(),
        scope: { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', path: [] },
        capabilities: ['identity.invitations.create'],
        membership: { ...access().membership, grants: [{
          scope: { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', path: [] },
          permissions: ['identity.invitation.manage'], effective: '2026-08-30T00:00:00Z', expires: null,
        }] } },
      input: {
        path: {},
        query: {},
        headers: {},
        body: { label: '普通管理员邀请', targetClient: 'operator', destination: '+8613800138000',
          storefrontOrganization: 'mall:one', maxUses: 1, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'invitation:one',
      },
    });

    expect(response).toMatchObject({ status: 201, body: { target_client: 'operator', code: expect.stringMatching(/^[0-9A-F]{10}$/) } });
    expect(invitationSql).toContain('target_client,storefront_organization_id');
    expect(invitationValues[7]).toBe('role-zhudatuan-pending-operator');
    expect(invitationValues[12]).toBe('operator');
    expect(invitationValues[13]).toBe('mall:one');
  });
});

describe('identity challenge notification queue', () => {
  it('enqueues registration challenges on the dedicated identity notification queue', async () => {
    let requestHash = '';
    let notificationSql = '';
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes('select invite.id from member.invite')) return result([{ id: 'invite:one' }]);
        if (text.includes('insert into identity.challenge')) {
          return result([{ id: 'challenge:one', purpose: 'registration', expires_at: new Date(Date.now() + 600_000).toISOString() }]);
        }
        if (text.includes('insert into runtime.job')) notificationSql = text;
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
    const moduleContext = context(pool);

    const response = await identityOperations(moduleContext).invoke({
      type: 'identity.challenges.create',
      access: null,
      input: {
        path: {},
        query: {},
        headers: {},
        body: { destination: '+8613800138000', invite: 'invitation-secret', purpose: 'registration' },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'registration-challenge:one',
      },
    });

    expect(response).toMatchObject({ status: 202, body: { purpose: 'registration' } });
    expect(notificationSql).toContain("'identitynotification','identity'");
    expect(notificationSql).not.toContain("'notification','identity'");
  });
});

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
  container.bind(KMS_CLIENT, {
    encrypt: async () => ({ ciphertext: 'ciphertext', keyVersion: 'key:v1', fingerprint: 'fingerprint' }),
    decrypt: async () => '+8613800138000',
  } as unknown as KmsClient);
  container.bind(RISK_GATE, { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) });
  container.bind(WECHAT_IDENTITY, {
    application: () => ({ applicationHash: 'application' }),
    authorize: () => 'https://example.test',
    exchange: async () => ({ subject: 'subject' }),
  });
  container.bind(RETURN_TARGETS, {
    console: 'https://console.example.test',
    storefront: 'https://storefront.example.test',
    store: 'https://store.example.test',
    supplier: 'https://supplier.example.test',
  });
  return { container } as unknown as ModuleContext;
}

function access(): NonNullable<OperationRequest['access']> {
  return {
    actor: {
      id: 'actor:one',
      session: 'session:one',
      membership: 'membership:one',
      credentialVersion: 1,
      accessVersion: 1,
      target: 'console',
      assurance: { level: 1 },
    },
    membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
    scope: { kind: 'platform', id: 'organization:one', path: [] },
    governance: { governanceLevel: 'owner', isExactOwner: true, actorMembershipId: 'membership:one', actorPrincipalId: 'actor:one',
      organizationId: 'organization:one', ownerMembershipId: 'membership:one',
      scope: { kind: 'platform', semanticId: 'organization:one', storageId: 'organization:one' },
      resolvedAt: new Date('2026-09-02T00:00:00.000Z') },
    accessVersion: 1,
    capabilities: ['identity.stepup.complete'],
    assurance: { level: 1 },
    trace: 'trace:one',
  };
}

function governanceAccess(
  governanceLevel: 'owner' | 'senior_administrator',
  isExactOwner: boolean
): NonNullable<OperationRequest['access']> {
  const base = access();
  const scope = { kind: 'tenant' as const, id: 'tenant:one', tenant: 'tenant:one', path: [] };
  return {
    ...base,
    scope,
    membership: { ...base.membership, grants: [{
      scope, permissions: ['member.manage'], effective: '2026-09-02T00:00:00.000Z', expires: null,
    }] },
    governance: {
      ...base.governance!, governanceLevel, isExactOwner, organizationId: 'tenant:one',
      ownerMembershipId: isExactOwner ? base.membership.id : 'membership:owner',
      scope: { kind: 'tenant', semanticId: 'tenant:one', storageId: 'tenant:one' },
    },
    capabilities: ['identity.members.manage'],
  };
}

function memberStatusRequest(accessContext: NonNullable<OperationRequest['access']>): OperationRequest {
  return {
    type: 'identity.members.manage',
    access: accessContext,
    input: {
      path: { membershipid: 'membership:target' }, query: {}, headers: {},
      body: { action: 'status', status: 'suspended', reason: '验证治理身份边界' }, rawBody: '',
      deadline: Date.now() + 1_000, signal: new AbortController().signal,
      idempotency: 'member-status:target',
    },
  };
}

function memberManagementHarness(targetGovernance: 'owner' | 'senior_administrator' | 'administrator'): Readonly<{
  pool: DatabasePool;
  queries: ReadonlyArray<Readonly<{ text: string; values: readonly unknown[] }>>;
}> {
  let requestHash = '';
  const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
  const client = {
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.includes('target_governance.governance_level')) {
        return result([{ member_id: 'member:target', governance_level: targetGovernance }]);
      }
      if (text.includes('set status=$2')) {
        return result([{ id: 'membership:target', member_id: 'member:target', status: values[1] }]);
      }
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

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
