import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { OperationCatalog, OPERATION_TARGETS } from '@shop/contract';
import { IdentityCapabilities } from '../Manifest';
import { PgMembershipContext } from '../infrastructure/persistence/PgMembershipContext';
import { withReadTransaction } from '../../../test/TransactionFixture';

const publicSessionOperations = [
  'identity.sessions.create',
  'identity.sessions.complete',
  'identity.tickets.exchange',
  'identity.memberships.read',
  'identity.memberships.switch',
  'identity.bootstrap.read',
  'identity.federations.start',
  'identity.federations.callback',
  'identity.federations.selection.read',
  'identity.federations.complete',
] as const;

describe('identity capability and six-surface contract', () => {
  it('publishes exactly the 39 canonical identity operations without LI compatibility aliases', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'identity');
    expect(operations).toHaveLength(39);
    expect(new Set(IdentityCapabilities)).toEqual(new Set(['identity.federation', 'identity.registration.reset', ...operations.map(({ capability }) => capability)]));
    for (const alias of ['identity.storefronts.read', 'identity.wechat.session', 'identity.wechat.bind', 'identity.members.create', 'identity.members.reset']) {
      expect(
        operations.some(({ id }) => id === alias),
        alias
      ).toBe(false);
    }
  });

  it('binds each public session, membership and federation flow to every runtime target', () => {
    for (const id of publicSessionOperations) expect(OperationCatalog.get(id).targets, id).toEqual(OPERATION_TARGETS);
  });

  it('exposes only the minimum membership context and never a credential or token', async () => {
    const queries: string[] = [];
    const value = await withReadTransaction(
      async (text) => {
        queries.push(text);
        return { rows: [{ principal_id: 'principal:one', membership_id: 'membership:one', membership_status: 'active', access_version: '4', assurance: '2' }], rowCount: 1 } as unknown as QueryResult;
      },
      (context) => new PgMembershipContext().read(context, 'principal:one', 'membership:one')
    );
    expect(value).toEqual({ principal: 'principal:one', membership: 'membership:one', membershipStatus: 'active', accessVersion: 4, assurance: 2 });
    expect(JSON.stringify(value)).not.toMatch(/credential|token|secret/i);
    expect(queries[0]).not.toMatch(/credential|token|secret/i);
  });
});
