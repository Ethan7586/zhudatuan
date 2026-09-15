import type { Scope } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { Actor } from '../../foundation/security/AccessContext';
import { WebBusinessScopeResolver } from './WebBusinessScopeResolver';

const actor: Actor = {
  id: 'principal:member',
  realm: 'realm:test',
  membershipClient: 'storefront',
  governanceOrganization: 'mall:one',
  session: 'session:member',
  membership: 'membership:member',
  credentialVersion: 1,
  accessVersion: 1,
  target: 'storefront',
  assurance: { level: 1 },
};

describe('WebBusinessScopeResolver', () => {
  it('resolves member-owned profile, address, and cart operations to the authenticated owner', async () => {
    const queries: Readonly<{ sql: string; values: readonly unknown[] | undefined }>[] = [];
    const owner: Scope = { kind: 'owner', id: 'member:one', path: [] };
    const pool = { query: async (sql: string, values?: readonly unknown[]) => {
      queries.push({ sql, values });
      return result([{ scope: owner }]);
    } } as unknown as DatabasePool;
    const resolver = new WebBusinessScopeResolver(pool);
    for (const operation of [
      'member.profile.read', 'member.addresses.read', 'member.addresses.manage',
      'cart.current.read', 'cart.items.put', 'cart.items.batch',
    ]) {
      await expect(resolver.resolve(actor, operation, 'untrusted-address-id')).resolves.toEqual(owner);
    }
    expect(queries).toHaveLength(6);
    expect(queries.every(({ sql, values }) => sql === 'select scope from access.resolve_session_scope($1,$2,$3,$4,$5,$6,$7)'
      && values?.[0] === actor.membership && values[1] === actor.realm
      && values[2] === actor.membershipClient && values[3] === actor.governanceOrganization)).toBe(true);
    expect(queries.map(({ values }) => values?.[4])).toEqual([
      'member.profile.read', 'member.addresses.read', 'member.addresses.manage',
      'cart.current.read', 'cart.items.put', 'cart.items.batch',
    ]);
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
    expect(queries.every(({ sql, values }) => sql === 'select scope from access.resolve_session_scope($1,$2,$3,$4,$5,$6,$7)'
      && values?.[0] === actor.membership && values[1] === actor.realm
      && values[2] === actor.membershipClient && values[3] === actor.governanceOrganization)).toBe(true);
    expect(queries.map(({ values }) => values?.[4])).toEqual([
      'catalog.listings.read', 'pricing.offers.read', 'inventory.availability.read',
    ]);
  });

  it('validates an owner operation against the same realm-aware storefront mall', async () => {
    const mall: Scope = { kind: 'mall', id: 'mall:one', path: [] };
    const pool = { query: async (sql: string, values?: readonly unknown[]) => {
      expect(sql).toBe('select scope from access.resolve_session_scope($1,$2,$3,$4,$5,$6,$7)');
      expect(values).toEqual([
        actor.membership,
        actor.realm,
        actor.membershipClient,
        actor.governanceOrganization,
        'catalog.listings.read',
        null,
        null,
      ]);
      return result([{ scope: mall }]);
    } } as unknown as DatabasePool;

    await expect(new WebBusinessScopeResolver(pool).resolveStorefrontScope(actor)).resolves.toEqual(mall);
  });

  it('retains the requested console scope for shared member-audience business reads', async () => {
    const mall: Scope = { kind: 'mall', id: 'mall:one', path: [] };
    const pool = { query: async (sql: string, values?: readonly unknown[]) => {
      expect(sql).toContain('access.resolve_session_scope');
      expect(values).toEqual([
        actor.membership,
        actor.realm,
        actor.membershipClient,
        actor.governanceOrganization,
        'catalog.listings.read',
        null,
        'mall:one',
      ]);
      return result([{ scope: mall }]);
    } } as unknown as DatabasePool;
    await expect(new WebBusinessScopeResolver(pool).resolve(
      { ...actor, target: 'console' }, 'catalog.listings.read', undefined, 'mall:one',
    )).resolves.toEqual(mall);
  });
});

function result(rows: readonly unknown[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
