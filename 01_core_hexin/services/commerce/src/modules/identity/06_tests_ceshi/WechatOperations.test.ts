import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AuditSink } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { WechatIdentity } from '../01_public_gongkai/ports_jiekou/WechatIdentity';
import type { PgAuthTicket } from '../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { WechatOperations } from '../05_interface_jieru/http/WechatOperations';

describe('wechat identity session', () => {
  it('locks identity-owned rows without requiring membership update privilege', async () => {
    const queries: string[] = [];
    let requestHash = '';
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push(text);
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values?.[3]);
        if (text.includes('select request_hash,state,response from runtime.idempotency')) {
          return result([{ request_hash: requestHash, state: 'started', response: null }]);
        }
        if (text.includes("from identity.federatedidentity where provider='wechat'")) {
          return result([{ id: 'wechat:one', principal_id: 'principal:one', membership_id: 'membership:one', status: 'active' }]);
        }
        if (text.includes('from access.membership membership join member.profile profile')) {
          if (!text.includes('for update of profile,principal')) throw new Error('permission denied for table membership');
          return result([{ access_version: 1, client: 'storefront', credential_version: 1 }]);
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
    const membershipQuery = queries.find((text) => text.includes('from access.membership membership join member.profile profile'));
    expect(membershipQuery).toContain('for update of profile,principal');
    expect(membershipQuery).not.toContain('for update of membership');
  });
});

function request(): OperationRequest {
  return {
    type: 'identity.wechat.session',
    access: null,
    input: {
      path: {}, query: {}, headers: { 'x-device-id': 'device:one', 'user-agent': 'wechat', 'x-peer-address': '127.0.0.1' },
      body: { scene: 'jsapi', action: 'exchange', code: 'wechat-code',
        authorization: { state: 's'.repeat(32), nonce: 'n'.repeat(32), challenge: 'c'.repeat(43) } },
      rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'wechat-session:one',
    },
  };
}

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
