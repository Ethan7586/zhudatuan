import { PGlite } from '@electric-sql/pglite';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { reject, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { atomicIdentityMutation, bindWechat } from '../04_adapters_shixian/persistence_cunchu/IdentityPersistence';

describe('identity persistence SQL', () => {
  it('uses a non-reserved alias when consuming a WeChat binding grant', async () => {
    const queries: string[] = [];
    const database: OperationDatabase = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes('from identity.wechatgrant')) return result([{ identity_id: 'identity:wechat', application_hash: 'hash:app' }]);
        if (text.includes("account_id=$3 and status='active'")) return result([]);
        if (text.startsWith('update identity.federatedidentity')) return result([{ id: 'identity:wechat' }]);
        return result([]);
      },
    };

    await expect(bindWechat(database, 'hash:token', 'principal:owner', 'membership:owner', 'realm:l0', 'account:l0'))
      .resolves.toBe('identity:wechat');
    expect(queries[0]).toContain('identity.wechatgrant bindinggrant');
    expect(queries[0]).not.toMatch(/\bidentity\.wechatgrant\s+grant\b/);
    expect(queries[0]).toContain("identity.status in('unbound','active')");
    expect(queries[0]).toContain('identity.realm_id=$2');
    expect(queries.find((text) => text.startsWith('update identity.federatedidentity')))
      .toContain('identity.realm_id=$4');
  });

  it('removes every business write on rejection while leaving the outer transaction usable', async () => {
    const database = new PGlite();
    try {
      await database.exec('create table identity_atomic_probe(id text primary key)');
      await database.exec('begin');
      await expect(atomicIdentityMutation(database as unknown as OperationDatabase, async () => {
        await database.query("insert into identity_atomic_probe(id) values('partial-account')");
        reject(409, 'WECHAT_IDENTITY_ALREADY_BOUND');
      })).rejects.toMatchObject({ result: { status: 409, body: { code: 'WECHAT_IDENTITY_ALREADY_BOUND' } } });
      const rolledBack = await database.query<{ count: number }>('select count(*)::integer count from identity_atomic_probe');
      expect(rolledBack.rows[0]?.count).toBe(0);
      await database.query("insert into identity_atomic_probe(id) values('outer-audit')");
      await database.exec('commit');
      const committed = await database.query<{ id: string }>('select id from identity_atomic_probe');
      expect(committed.rows).toEqual([{ id: 'outer-audit' }]);
    } finally {
      await database.close();
    }
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
