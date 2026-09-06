import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { bindWechat } from '../04_adapters_shixian/persistence_cunchu/IdentityPersistence';

describe('identity persistence SQL', () => {
  it('uses a non-reserved alias when consuming a WeChat binding grant', async () => {
    const queries: string[] = [];
    const database: OperationDatabase = {
      query: async (text: string) => {
        queries.push(text);
        if (text.includes('from identity.wechatgrant')) return result([{ identity_id: 'identity:wechat', application_hash: 'hash:app' }]);
        if (text.includes('status=\'active\' and id<>')) return result([]);
        if (text.startsWith('update identity.federatedidentity')) return result([{ id: 'identity:wechat' }]);
        return result([]);
      },
    };

    await expect(bindWechat(database, 'hash:token', 'principal:owner', 'membership:owner')).resolves.toBe('identity:wechat');
    expect(queries[0]).toContain('identity.wechatgrant bindinggrant');
    expect(queries[0]).not.toMatch(/\bidentity\.wechatgrant\s+grant\b/);
    expect(queries[0]).toContain("identity.status in('unbound','active')");
    expect(queries.find((text) => text.startsWith('update identity.federatedidentity')))
      .toContain("status in('unbound','active')");
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
