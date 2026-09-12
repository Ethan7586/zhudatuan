import { createHash } from 'node:crypto';
import { canonicalFinancialActionRequest } from '@shop/contract';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { NODE_MANIFEST } from '../../../bootstrap/NodeRuntime';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import { RISK_GATE } from '../../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from '../01_public_gongkai/ports_jiekou/WechatIdentity';
import { identityOperations } from '../05_interface_jieru/http/IdentityOperations';

describe('identity session projection', () => {
  it('returns the active member name without requiring a separate profile permission', async () => {
    const client = {
      query: async (text: string) => {
        if (text.includes('from access.membership membership join identity.account account')) {
          return { rows: [{ account_id: 'account:one', realm_id: 'realm:l0', principal_id: 'actor:one', credential_version: 1 }],
            rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('identity.resolve_active_membership_context')) return result([{
          entry_realm_id: 'realm:l0', current_realm_id: 'realm:l0', account_id: 'account:one',
          active_membership_id: 'membership:one', line_id: 'line:zhudatuan:commerce:v1', node_id: 'node:zhudatuan:l0',
          parent_node_id: null, signed_level: 'L0', sovereignty_tier: 'sovereign', node_profile: 'operating_mall',
          mall_id: 'mall-zhudatuan', host_sovereign_node_id: 'node:zhudatuan:l0', relation_version: 1,
          effective_at: '2026-09-01T00:00:00.000Z', access_version: 1, status: 'active',
        }]);
        if (text.includes('select rotated_at from identity.credential')) return result([{ rotated_at: null }]);
        if (text.includes('select display_name,mobile_ciphertext from member.profile')) {
          return result([{ display_name: '张三', mobile_ciphertext: 'ciphertext:mobile' }]);
        }
        if (text.includes('select mobile_masked from identity.account')) return result([{ mobile_masked: '+86****8000' }]);
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
        active_context: { current_realm_id: 'realm:l0', active_membership_id: 'membership:one' },
      },
    });
  });

  it('lists and revokes sessions only inside the authenticated realm account', async () => {
    let requestHash = '';
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
        if (text.startsWith('select request_hash,state,response')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes('account.legacy_principal_id=$2')) {
          return result([{ account_id: 'account:l11', realm_id: 'realm:l11', principal_id: 'actor:one', credential_version: 1 }]);
        }
        if (text.includes("revoked_reason='security_center'")) return result([{ id: 'session:l11:other' }]);
        return result([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool: DatabasePool = { connect: async () => client, query: async () => result([]), workload: () => pool, end: async () => undefined };
    const baseAccess = access();
    const response = await identityOperations(context(pool)).invoke({
      type: 'identity.sessions.revoke',
      access: { ...baseAccess, capabilities: ['identity.sessions.revoke'] },
      input: { path: { sessionid: 'others' }, query: {}, headers: {}, body: {}, rawBody: '',
        deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'sessions:realm:l11' },
    });

    expect(response).toMatchObject({ status: 200, body: { revoked: 1, sessions: ['session:l11:other'] } });
    const revocation = queries.find(({ text }) => text.includes("revoked_reason='security_center'"));
    expect(revocation?.text).toContain('account_id=$1 and realm_id=$2');
    expect(revocation?.text).not.toContain('principal_id');
    expect(revocation?.values).toEqual(['account:l11', 'realm:l11', 'session:one']);
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
    expect(targetRead?.text).toContain('access.resolve_authoritative_governance');
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

  it('lets the authoritative Owner principal manage a senior administrator from its node membership', async () => {
    const harness = memberManagementHarness('senior_administrator');

    const response = await identityOperations(context(harness.pool)).invoke(
      memberStatusRequest(governanceAccess('owner', false))
    );

    expect(response).toMatchObject({ status: 200, body: { id: 'membership:target', status: 'suspended' } });
  });

  it('offboards an administrator by expiring every management relation while preserving member data', async () => {
    const harness = memberManagementHarness('administrator');

    const response = await identityOperations(context(harness.pool)).invoke(
      memberStatusRequest(governanceAccess('senior_administrator', false), 'offboarded')
    );

    expect(response).toMatchObject({ status: 200, body: { id: 'membership:target', status: 'left' } });
    expect(harness.queries.some(({ text }) => text.includes('update access.membershiprole set expires_at'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('update access.scopegrant set expires_at'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes('update access.membershipoverride set revoked_at'))).toBe(true);
    expect(harness.queries.some(({ text }) => text.includes("update member.invite set status='disabled'"))).toBe(true);
    expect(harness.queries.some(({ text }) => /delete from (member\.profile|identity\.principal)/.test(text))).toBe(false);
  });
});

describe('identity financial action proof issuance', () => {
  it('binds the proof to the assurance created for this exact session and the canonical request hash', async () => {
    let storedHash = '';
    let assuranceId = '';
    let assuranceSession = '';
    let phoneEvidence = '';
    let issueValues: readonly unknown[] | undefined;
    let persisted = '';
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('from access.membership membership join identity.account account')) {
          return { rows: [{ account_id: 'account:one', realm_id: 'realm:l0', principal_id: 'actor:one', credential_version: 1 }],
            rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('insert into runtime.idempotency')) storedHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
        if (text.startsWith('select request_hash,state,response')) {
          return { rows: [{ request_hash: storedHash, state: 'started', response: null }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('update identity.challenge set consumed_at')) {
          return { rows: [{ principal_id: 'actor:one', account_id: 'account:one', realm_id: 'realm:l0' }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('select mobile_ciphertext from identity.account')) {
          return { rows: [{ mobile_ciphertext: 'ciphertext:verified-mobile' }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes("'phone_otp',2")) phoneEvidence = String(values[2]);
        if (text.includes("'otp',3")) {
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
    expect(phoneEvidence).toMatch(/^[0-9a-f]{64}$/);
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
        if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l0', node_id: 'l0' }]);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
        if (text.startsWith('select request_hash,state,response')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes('access.zhudatuan_owner_context')) return result([{ exact_owner: true }]);
        if (text.trimStart().startsWith('select account.id account_id')) {
          return result([{ account_id: 'account:owner', realm_id: 'realm:l0', principal_id: 'actor:one', credential_version: 1 }]);
        }
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
        headers: { host: 'api.zhudatuan.com' },
        body: { label: '普通管理员邀请', targetClient: 'operator', destination: '+8613800138000',
          storefrontOrganization: 'mall:one', maxUses: 1, expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'invitation:one',
      },
    });

    expect(response).toMatchObject({ status: 201, body: { target_client: 'operator', code: expect.stringMatching(/^[A-F]{2}[0-9A-F]{8}$/) } });
    expect(invitationSql).toContain('target_client,storefront_organization_id,destination_masked');
    expect(invitationValues[7]).toBe('role-zhudatuan-pending-operator');
    expect(invitationValues[12]).toBe('operator');
    expect(invitationValues[13]).toBe('mall:one');
    expect(invitationValues[14]).toBe('138****8000');
  });
});

describe('identity challenge notification queue', () => {
  it('enqueues shared-api registration challenges for the resolved entry node', async () => {
    let requestHash = '';
    let notificationSql = '';
    let notificationValues: readonly unknown[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l1', node_id: 'node:hbbtzn:l1' }]);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
        if (text.startsWith('select request_hash,state,response')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes('select invite.id from member.invite')) return result([{ id: 'invite:one' }]);
        if (text.includes('insert into identity.challenge')) {
          return result([{ id: 'challenge:one', purpose: 'registration', expires_at: new Date(Date.now() + 600_000).toISOString() }]);
        }
        if (text.includes('insert into runtime.job')) { notificationSql = text; notificationValues = values; }
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
        headers: { host: 'api.hbbtzn.com' },
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
    expect(notificationValues[1]).toBe('node:hbbtzn:l1');
  });
});

function context(pool: DatabasePool, notificationNode?: string): ModuleContext {
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
    jsSdkConfiguration: async () => { throw new Error('not used'); },
  });
  if (notificationNode) container.bind(NODE_MANIFEST, {
    node_id: notificationNode,
    parent_node_id: 'node:zhudatuan:l0',
  } as never);
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

function memberStatusRequest(accessContext: NonNullable<OperationRequest['access']>, status = 'suspended'): OperationRequest {
  return {
    type: 'identity.members.manage',
    access: accessContext,
    input: {
      path: { membershipid: 'membership:target' }, query: {}, headers: {},
      body: { action: 'status', status, reason: '验证治理身份边界' }, rawBody: '',
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
      if (text.includes("update runtime.idempotency set state='completed'")) return { rows: [], rowCount: 1 } as unknown as QueryResult;
      if (text.startsWith('select request_hash,state,response')) {
        return result([{ request_hash: requestHash, state: 'started', response: null }]);
      }
      if (text.includes('target_governance.governance_level')) {
        return result([{ member_id: 'member:target', account_id: 'account:target', realm_id: 'realm:l0',
          organization_id: 'organization:one', governance_level: targetGovernance }]);
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
