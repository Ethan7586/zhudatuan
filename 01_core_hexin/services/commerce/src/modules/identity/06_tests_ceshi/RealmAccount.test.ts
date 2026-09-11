import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { resolveActiveMembershipContext, resolveRealmContext } from '../03_application_yingyong/services_fuwu/RealmAccount';

vi.mock('@shop/config/sfl-node-kernel', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  parseActiveRealmMembershipContext: (value: unknown) => value,
}));

describe('active Realm Membership compatibility', () => {
  it('uses the legacy projection when the database resolver is not installed yet', async () => {
    const missingFunction = Object.assign(new Error('function identity.resolve_active_membership_context does not exist'), { code: '42883' });
    const row = {
      entry_realm_id: 'realm:l0', current_realm_id: 'realm:l0', account_id: 'account:one',
      active_membership_id: 'membership:one', line_id: 'line:one', node_id: 'node:one', parent_node_id: null,
      signed_level: 'L0', sovereignty_tier: 'sovereign', node_profile: 'operating_mall', mall_id: 'mall:one',
      host_sovereign_node_id: 'node:one', relation_version: 1, effective_at: '2026-09-11T00:00:00.000Z',
      access_version: 1, status: 'active',
    };
    const query = vi.fn()
      .mockRejectedValueOnce(missingFunction)
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 } as unknown as QueryResult);

    await expect(resolveActiveMembershipContext({ query } as unknown as OperationDatabase,
      'realm:l0', 'account:one', 'membership:one')).resolves.toMatchObject({
      current_realm_id: 'realm:l0', active_membership_id: 'membership:one',
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("account.realm_id=$1");
  });
});

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
