import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { Container } from '../../../bootstrap/Container';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL, type DatabasePool } from '../../../foundation/persistence/Pool';
import { RISK_GATE } from '../../../foundation/security/RiskGate';
import { WECHAT_IDENTITY } from '../01_public_gongkai/ports_jiekou/WechatIdentity';
import { identityOperations } from '../05_interface_jieru/http/IdentityOperations';

describe('root identity registration reset', () => {
  it('atomically releases the login subject while retaining historical identifiers', async () => {
    const originalSubject = 'a'.repeat(64);
    let requestHash = '';
    const statements: Readonly<{ text: string; values: readonly unknown[] }>[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        statements.push({ text, values });
        if (text.includes('account.legacy_principal_id=$2')) {
          return rows([{ account_id: 'account:actor:l0', realm_id: 'realm:l0', principal_id: 'actor:one', credential_version: 1 }]);
        }
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) return rows([{ request_hash: requestHash, state: 'started', response: null }]);
        if (text.includes('account.status account_status')) {
          return rows([{ member_id: 'member:target', account_id: 'account:target:l0', realm_id: 'realm:l0',
            principal_id: 'principal:target', account_status: 'active', account_version: 7, organization_id: 'tenant:one' }]);
        }
        if (text.includes('from access.membership owner_membership')) return rows([]);
        if (text.startsWith('select id,organization_id from access.membership')) {
          return rows([{ id: 'membership:target:storefront', organization_id: 'tenant:one' }, { id: 'membership:target:operator', organization_id: 'tenant:one' }]);
        }
        if (text.includes('not access.scope_allowed')) return rows([]);
        if (text.includes('from identity.assurance')) return rows([{ verified: 1 }]);
        if (text.startsWith('select id,provider,status,subject_hash from identity.credential')) {
          return rows([{ id: 'credential:target', provider: 'password', status: 'active', subject_hash: originalSubject }]);
        }
        if (text.startsWith('select id from identity.federatedidentity')) return rows([]);
        if (text.includes('update identity.account set status')) return rows([{ version: 8 }]);
        return rows([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool = databasePool(client);

    const response = await identityOperations(context(pool)).invoke(resetRequest());

    expect(response).toEqual({
      status: 200,
      body: { principal_id: 'principal:target', account_id: 'account:target:l0', status: 'reset',
        login_identity_released: true, history_retained: true, version: 8 },
    });
    expect(statements.some(({ text }) => text.includes('pg_advisory_xact_lock(hashtext($1))'))).toBe(true);
    expect(statements.some(({ text }) => text.includes('update identity.session session set') && text.includes("'identity_reset'"))).toBe(true);
    const credentialUpdate = statements.find(({ text }) => text.includes("update identity.credential set status='revoked'"));
    expect(credentialUpdate?.values[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(credentialUpdate?.values[1]).not.toBe(originalSubject);
    expect(statements.filter(({ text }) => text.includes("update access.membership set status='left'"))).toHaveLength(1);
    expect(statements.some(({ text }) => text.includes("update member.profile set display_name='已重置成员"))).toBe(true);
    expect(statements.some(({ text, values }) => text.includes('insert into runtime.outbox') && values[1] === 'identity.member.reset')).toBe(true);
  });

  it('rejects resetting the signed-in owner before touching credentials', async () => {
    let requestHash = '';
    const statements: string[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        statements.push(text);
        if (text.includes('account.legacy_principal_id=$2')) {
          return rows([{ account_id: 'account:owner:l0', realm_id: 'realm:l0', principal_id: 'actor:one', credential_version: 1 }]);
        }
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) return rows([{ request_hash: requestHash, state: 'started', response: null }]);
        if (text.includes('account.status account_status')) {
          return rows([{ member_id: 'member:owner', account_id: 'account:owner:l0', realm_id: 'realm:l0',
            principal_id: 'actor:one', account_status: 'active', account_version: 7, organization_id: 'organization:one' }]);
        }
        return rows([]);
      },
      release: () => undefined,
    } as unknown as PoolClient;

    const response = await identityOperations(context(databasePool(client))).invoke(resetRequest());

    expect(response).toEqual({ status: 409, body: { code: 'OWNER_MEMBERSHIP_PROTECTED' } });
    expect(statements.some((text) => text.includes('update identity.credential'))).toBe(false);
  });
});

function resetRequest(): OperationRequest {
  return {
    type: 'identity.members.reset',
    access: access(),
    input: {
      path: { membershipid: 'membership:target:operator' }, query: {}, headers: {}, body: { reason: '重新邀请测试成员' }, rawBody: '',
      deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'reset:one', expectedVersion: 7,
    },
  };
}

function databasePool(client: PoolClient): DatabasePool {
  const pool: DatabasePool = { connect: async () => client, query: async () => rows([]), workload: () => pool, end: async () => undefined };
  return pool;
}

function context(pool: DatabasePool): ModuleContext {
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
  container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-key', session: 'session-key' });
  container.bind(KMS_CLIENT, {} as KmsClient);
  container.bind(RISK_GATE, { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) });
  container.bind(WECHAT_IDENTITY, { application: () => ({ applicationHash: 'application' }), authorize: () => 'https://example.test', exchange: async () => ({ subject: 'subject' }) });
  return { container } as unknown as ModuleContext;
}

function access(): NonNullable<OperationRequest['access']> {
  return {
    actor: { id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 1 } },
    membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
    scope: { kind: 'platform', id: 'organization:one', path: [] }, accessVersion: 1,
    governance: { governanceLevel: 'owner', isExactOwner: true, actorMembershipId: 'membership:one', actorPrincipalId: 'actor:one',
      organizationId: 'organization:one', ownerMembershipId: 'membership:one',
      scope: { kind: 'platform', semanticId: 'organization:one', storageId: 'organization:one' },
      resolvedAt: new Date('2026-09-02T00:00:00.000Z') },
    capabilities: ['identity.members.reset'], assurance: { level: 1 }, trace: 'trace:one',
  };
}

function rows(values: readonly Record<string, unknown>[]): QueryResult {
  return { rows: values, rowCount: values.length } as unknown as QueryResult;
}
