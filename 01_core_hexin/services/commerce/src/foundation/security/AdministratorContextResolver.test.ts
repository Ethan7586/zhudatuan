import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import { PgAdministratorContextResolver } from './AdministratorContextResolver';

describe('PgAdministratorContextResolver', () => {
  it('binds one active operator membership to its explicit Realm, role, permission and segment scope', async () => {
    const resolver = new PgAdministratorContextResolver(pool([row()]));
    await expect(resolver.resolve(actor())).resolves.toMatchObject({
      administrator_identity_id: 'administrator:operator',
      active_membership_id: 'membership:operator',
      realm_id: 'realm:a',
      role_kind: 'administrator',
      scope: { segment: 'first_segment', line_id: 'line:a', root_node_id: 'node:a:l0', scope_version: 2 },
    });
  });

  it('does not convert a member session or a different Realm membership into an administrator', async () => {
    const resolver = new PgAdministratorContextResolver(pool([row()]));
    await expect(resolver.resolve({ ...actor(), target: 'storefront' })).rejects.toThrow('SFL_ADMINISTRATOR_IDENTITY_REQUIRED');
    await expect(resolver.resolve({ ...actor(), realm: 'realm:b' })).rejects.toThrow('SFL_ADMINISTRATOR_CONTEXT_MISMATCH');
  });
});

function actor() {
  return { id: 'principal:a', account: 'account:a', realm: 'realm:a', session: 'session:a',
    membership: 'membership:operator', credentialVersion: 1, accessVersion: 3, target: 'console' as const,
    assurance: { level: 2 } };
}

function row() {
  return { administrator_identity_id: 'administrator:operator', administrator_identity_version: 1,
    active_membership_id: 'membership:operator', account_id: 'account:a', principal_id: 'principal:a', realm_id: 'realm:a',
    host_node_id: 'node:a:l0', role_kind: 'administrator' as const, role_ids: ['role:administrator'],
    permissions: ['member.read'], scope_id: 'admin-scope:operator:2', scope_version: 2, line_id: 'line:a',
    root_node_id: 'node:a:l0', segment: 'first_segment' as const, access_version: 3,
    effective_at: new Date('2026-09-12T00:00:00.000Z') };
}

function pool(rows: readonly Record<string, unknown>[]) {
  return { query: async <R extends QueryResultRow = QueryResultRow>() => ({ rows, rowCount: rows.length } as unknown as QueryResult<R>) };
}
