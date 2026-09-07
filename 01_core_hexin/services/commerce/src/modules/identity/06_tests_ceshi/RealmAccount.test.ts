import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { resolveRealmContext } from '../03_application_yingyong/services_fuwu/RealmAccount';

describe('realm registry boundary', () => {
  it('resolves an L11 node entirely from registry rows without a compiled node list', async () => {
    const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('from identity.realmentry entry')) {
          return result([{ realm_id: 'realm:l11', node_id: 'l11' }]);
        }
        return result([{
          surface: 'consumer', membership_client: 'storefront', membership_organization_id: 'mall:l11',
          application_slug: 'l11-storefront',
        }]);
      },
    } as unknown as OperationDatabase;

    await expect(resolveRealmContext(database, 'Accounts.L11.Example.com:443', 'storefront', 'l11-storefront'))
      .resolves.toMatchObject({ realmId: 'realm:l11', nodeId: 'l11', entryHost: 'accounts.l11.example.com',
        membershipOrganizationId: 'mall:l11', application: 'l11-storefront' });
    expect(calls[0]?.values).toEqual(['accounts.l11.example.com']);
    expect(calls[1]?.values).toEqual(['realm:l11', 'storefront']);
  });

  it('rejects an unregistered Host after a read-only lookup', async () => {
    const calls: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const database = {
      query: async (text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        return result([]);
      },
    } as unknown as OperationDatabase;

    await expect(resolveRealmContext(database, 'forged.identity.example', 'console', undefined))
      .rejects.toThrow('AUTH_REALM_ENTRY_INVALID');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual(['forged.identity.example']);
    expect(calls.every(({ text }) => text.trimStart().startsWith('select '))).toBe(true);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
