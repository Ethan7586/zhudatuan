import type { Scope } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { Actor } from '../../foundation/security/AccessContext';
import { WebBusinessScopeResolver } from './WebBusinessScopeResolver';

const actor: Actor = {
  id: 'principal:member',
  session: 'session:member',
  membership: 'membership:member',
  credentialVersion: 1,
  accessVersion: 1,
  target: 'storefront',
  assurance: { level: 1 },
};

describe('WebBusinessScopeResolver', () => {
  it('resolves all member profile and address operations to the authenticated owner', async () => {
    const queries: Readonly<{ sql: string; values: readonly unknown[] | undefined }>[] = [];
    const owner: Scope = { kind: 'owner', id: 'member:one', path: [] };
    const pool = { query: async (sql: string, values?: readonly unknown[]) => {
      queries.push({ sql, values });
      return result([{ scope: owner }]);
    } } as unknown as DatabasePool;
    const resolver = new WebBusinessScopeResolver(pool);
    for (const operation of ['member.profile.read', 'member.addresses.read', 'member.addresses.manage']) {
      await expect(resolver.resolve(actor, operation, 'untrusted-address-id')).resolves.toEqual(owner);
    }
    expect(queries).toHaveLength(3);
    expect(queries.every(({ sql, values }) => sql === 'select access.web_member_scope($1,$2) scope'
      && values?.[0] === actor.membership && values[1] === actor.session)).toBe(true);
  });

  it('resolves storefront browsing operations to the session-bound mall', async () => {
    const queries: Readonly<{ sql: string; values: readonly unknown[] | undefined }>[] = [];
    const mall: Scope = { kind: 'mall', id: 'mall:one', path: [] };
    const pool = { query: async (sql: string, values?: readonly unknown[]) => {
      queries.push({ sql, values });
      return result([{ scope: mall }]);
    } } as unknown as DatabasePool;
    const resolver = new WebBusinessScopeResolver(pool);
    for (const operation of ['catalog.listings.read', 'pricing.offers.read', 'inventory.availability.read']) {
      await expect(resolver.resolve(actor, operation)).resolves.toEqual(mall);
    }
    expect(queries).toHaveLength(3);
    expect(queries.every(({ sql, values }) => sql === 'select access.web_storefront_scope($1,$2) scope'
      && values?.[0] === actor.membership && values[1] === actor.session)).toBe(true);
  });

  it('retains canonical scope resolution for every other operation', async () => {
    const mall: Scope = { kind: 'mall', id: 'mall:one', path: [] };
    const pool = { query: async (sql: string) => {
      expect(sql).toContain('access.resolve_scope');
      return result([{ scope: mall }]);
    } } as unknown as DatabasePool;
    await expect(new WebBusinessScopeResolver(pool).resolve({ ...actor, target: 'console' }, 'catalog.listings.read')).resolves.toEqual(mall);
  });
});

function result(rows: readonly unknown[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
