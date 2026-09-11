import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { AuditSink } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { WechatIdentity } from '../01_public_gongkai/ports_jiekou/WechatIdentity';
import type { PgAuthTicket } from '../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { WechatOperations } from '../05_interface_jieru/http/WechatOperations';

describe('wechat identity session', () => {
  it('returns a server-signed JS-SDK configuration for the actual page URL', async () => {
    const jsSdkConfiguration = vi.fn(async () => ({
      appId: 'wx4df4137881a1d2bd', timestamp: 1_788_800_000, nonceStr: 'nonce', signature: 'a'.repeat(40), jsApiList: ['openAddress'] as const,
    }));
    const pool = { connect: async () => { throw new Error('database should not be used'); } } as unknown as DatabasePool;
    const operation = new WechatOperations({ invoke: async () => ({ status: 404, body: {} }) }, pool, {
      application: () => ({ applicationHash: 'application-hash' }),
      authorize: () => 'https://example.test',
      exchange: async () => ({ subject: 'openid-one' }),
      jsSdkConfiguration,
    }, {} as KmsClient, {} as AuditSink, 'identity-key', 'session-key', {} as PgAuthTicket);
    const base = request();
    const input: OperationRequest = { ...base, input: { ...base.input,
      body: { scene: 'jsapi', action: 'jssdk_config', url: 'https://hbbtzn.com/?from=wechat' } } };

    await expect(operation.invoke(input)).resolves.toMatchObject({ status: 200, body: { jsApiList: ['openAddress'] } });
    expect(jsSdkConfiguration).toHaveBeenCalledWith('https://hbbtzn.com/?from=wechat');
  });

  it('locks identity-owned rows without requiring membership update privilege', async () => {
    const queries: string[] = [];
    let requestHash = '';
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push(text);
        if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l0', node_id: 'l0' }]);
        if (text.includes('from identity.realmtarget where realm_id=$1')) return result([{
          surface: 'consumer', membership_client: 'storefront', membership_organization_id: 'mall-zhudatuan',
          application_slug: 'zhudatuan-storefront',
        }]);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values?.[3]);
        if (text.includes("update runtime.idempotency set state='completed'")) return result([{}]);
        if (text.includes('select request_hash,state,response from runtime.idempotency')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes("from identity.federatedidentity where realm_id=$1")) {
          return result([{ id: 'wechat:one', principal_id: 'principal:one', membership_id: 'membership:one',
            account_id: 'account:one', realm_id: 'realm:l0', status: 'active' }]);
        }
        if (text.includes('from access.membership membership join identity.account account')) {
          if (!text.includes('for update of account')) throw new Error('identity account was not locked');
          if (text.includes('for update of membership')) throw new Error('permission denied for table membership');
          return result([{ access_version: 1, client: 'storefront', credential_version: 1, auth_target: 'storefront' }]);
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
    const gateway: WechatIdentity = {
      application: () => ({ applicationHash: 'application-hash' }),
      authorize: () => 'https://example.test',
      exchange: async () => ({ subject: 'openid-one' }),
      jsSdkConfiguration: async () => { throw new Error('not used'); },
    };
    const kms = {
      encrypt: async () => ({ ciphertext: 'ciphertext', keyVersion: 'key:v1', fingerprint: 'fingerprint' }),
    } as unknown as KmsClient;
    const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
    const tickets = {
      issue: async () => ({ ticket: 't'.repeat(64), state: 's'.repeat(32) }),
    } as unknown as PgAuthTicket;
    const operation = new WechatOperations({ invoke: async () => ({ status: 404, body: {} }) }, pool, gateway, kms, audit,
      'identity-key', 'session-key', tickets);

    const response = await operation.invoke(request());

    expect(response).toMatchObject({ status: 201, body: { membership: 'membership:one' } });
    const membershipQuery = queries.find((text) => text.includes('from access.membership membership join identity.account account'));
    expect(membershipQuery).toContain('for update of account');
    expect(membershipQuery).not.toContain('for update of membership');
  });

  it('keeps the authenticated account and requests confirmation when WeChat belongs to another principal', async () => {
    const queries: string[] = [];
    let requestHash = '';
    let ticketIssued = false;
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push(text);
        if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l0', node_id: 'l0' }]);
        if (text.includes('from identity.realmtarget where realm_id=$1')) return result([{
          surface: 'consumer', membership_client: 'storefront', membership_organization_id: 'mall-zhudatuan',
          application_slug: 'zhudatuan-storefront',
        }]);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values?.[3]);
        if (text.includes("update runtime.idempotency set state='completed'")) return result([{}]);
        if (text.includes('select request_hash,state,response from runtime.idempotency')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes("from identity.federatedidentity where realm_id=$1")) {
          return result([{ id: 'wechat:one', principal_id: 'principal:previous', membership_id: 'membership:previous',
            account_id: 'account:previous', realm_id: 'realm:l0', status: 'active' }]);
        }
        if (text.includes('account.legacy_principal_id=$2')) {
          return result([{ account_id: 'account:current', realm_id: 'realm:l0', principal_id: 'principal:current', credential_version: 1 }]);
        }
        if (text.includes('from access.membership membership join identity.account account')) {
          throw new Error('must not create a session for the previous account');
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
    const gateway: WechatIdentity = {
      application: () => ({ applicationHash: 'application-hash' }),
      authorize: () => 'https://example.test',
      exchange: async () => ({ subject: 'openid-one' }),
      jsSdkConfiguration: async () => { throw new Error('not used'); },
    };
    const kms = {
      encrypt: async () => ({ ciphertext: 'ciphertext', keyVersion: 'key:v1', fingerprint: 'fingerprint' }),
    } as unknown as KmsClient;
    const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
    const tickets = {
      issue: async () => {
        ticketIssued = true;
        return { ticket: 't'.repeat(64), state: 's'.repeat(32) };
      },
    } as unknown as PgAuthTicket;
    const operation = new WechatOperations({ invoke: async () => ({ status: 404, body: {} }) }, pool, gateway, kms, audit,
      'identity-key', 'session-key', tickets);

    const response = await operation.invoke(request(authenticatedAccess()));

    expect(response).toMatchObject({ status: 202, body: { state: 'account_confirmation_required' } });
    expect(ticketIssued).toBe(false);
    expect(queries.some((text) => text.includes('insert into identity.wechatgrant'))).toBe(true);
    expect(queries.some((text) => text.includes('insert into identity.session'))).toBe(false);
  });

  it('rolls back the WeChat identity and idempotency when the binding session is rejected', async () => {
    const queries: string[] = [];
    let requestHash = '';
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push(text);
        if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l0', node_id: 'l0' }]);
        if (text.includes('from identity.realmtarget where realm_id=$1')) return result([{
          surface: 'consumer', membership_client: 'storefront', membership_organization_id: 'mall-zhudatuan',
          application_slug: 'zhudatuan-storefront',
        }]);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values?.[3]);
        if (text.includes("update runtime.idempotency set state='completed'")) return result([{}]);
        if (text.includes('select request_hash,state,response from runtime.idempotency')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes("from identity.federatedidentity where realm_id=$1")) {
          return result([{ id: 'wechat:revoked', principal_id: null, membership_id: null,
            account_id: null, realm_id: 'realm:l0', status: 'revoked' }]);
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
    const operation = new WechatOperations({ invoke: async () => ({ status: 404, body: {} }) }, pool, {
      application: () => ({ applicationHash: 'application-hash' }),
      authorize: () => 'https://example.test',
      exchange: async () => ({ subject: 'openid-revoked' }),
      jsSdkConfiguration: async () => { throw new Error('not used'); },
    }, {
      encrypt: async () => ({ ciphertext: 'ciphertext', keyVersion: 'key:v1', fingerprint: 'fingerprint' }),
    } as unknown as KmsClient, { record: async () => undefined, access: async () => undefined },
    'identity-key', 'session-key', {} as PgAuthTicket);

    await expect(operation.invoke(request())).rejects.toMatchObject({
      result: { status: 403, body: { code: 'WECHAT_IDENTITY_REVOKED' } },
    });
    const identityInsert = queries.findIndex((text) => text.includes('insert into identity.federatedidentity'));
    const rollback = queries.indexOf('rollback');
    expect(identityInsert).toBeGreaterThanOrEqual(0);
    expect(rollback).toBeGreaterThan(identityInsert);
    expect(queries).not.toContain('commit');
  });

  it('rejects an L0 return target when the WeChat login belongs to the L1 storefront', async () => {
    const client = { query: async (text: string) => {
      if (text.includes('from identity.realmentry entry')) return result([{ realm_id: 'realm:l0', node_id: 'l0' }]);
      if (text.includes('from identity.realmtarget where realm_id=$1')) return result([{
        surface: 'consumer', membership_client: 'storefront', membership_organization_id: 'mall-zhudatuan',
        application_slug: 'zhudatuan-storefront',
      }]);
      return result([]);
    }, release: () => undefined } as unknown as PoolClient;
    const pool: DatabasePool = { connect: async () => client, query: async () => result([]), workload: () => pool, end: async () => undefined };
    const operation = new WechatOperations({ invoke: async () => ({ status: 404, body: {} }) }, pool, {
      application: () => ({ applicationHash: 'application-hash' }), authorize: () => 'https://example.test',
      exchange: async () => { throw new Error('must reject before WeChat code exchange'); },
      jsSdkConfiguration: async () => { throw new Error('not used'); },
    }, {} as KmsClient, {} as AuditSink, 'identity-key', 'session-key', {} as PgAuthTicket);

    await expect(operation.invoke(request(null, { application: 'zdt-l1-verify', target: 'storefront' })))
      .rejects.toThrow('AUTH_REALM_MISMATCH');
  });
});

function request(access: OperationRequest['access'] = null,
  identity: Readonly<{ application: string; target: 'storefront' | 'storefront-hbbtzn' }> = {
    application: 'zhudatuan-storefront', target: 'storefront',
  }): OperationRequest {
  return {
    type: 'identity.wechat.session',
    access,
    input: {
      path: {}, query: {}, headers: { host: 'api.zhudatuan.com', 'x-device-id': 'device:one', 'user-agent': 'wechat', 'x-peer-address': '127.0.0.1' },
      body: { scene: 'jsapi', action: 'exchange', code: 'wechat-code', ...identity,
        authorization: { state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43) } },
      rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'wechat-session:one',
    },
  };
}

function authenticatedAccess(): NonNullable<OperationRequest['access']> {
  return {
    actor: { id: 'principal:current', session: 'session:current', membership: 'membership:current', credentialVersion: 1,
      accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
    membership: { id: 'membership:current', active: true, accessVersion: 1, denies: [], grants: [] },
    scope: { kind: 'mall', id: 'mall:one', path: [] },
    governance: { governanceLevel: 'member', isExactOwner: false, actorMembershipId: 'membership:current',
      actorPrincipalId: 'principal:current', organizationId: 'mall:one',
      scope: { kind: 'mall', semanticId: 'mall:one', storageId: 'mall:one' }, resolvedAt: new Date('2026-09-06T00:00:00.000Z') },
    accessVersion: 1,
    capabilities: ['identity.credential.manage'],
    assurance: { level: 1 },
    trace: 'trace:current',
  };
}

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
