import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { AccessVersionService } from '../service/AccessVersionService';
import { TransferOwner } from './TransferOwner';
import { PgAccessRepository } from '../../infrastructure/persistence/PgAccessRepository';

describe('TransferOwner', () => {
  it('locks in stable order, replaces the typed owner role and bumps both access versions once', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async (text) => {
      if (text.includes('from access.ownership ownership')) return result([{ scope_id: 'tenant:one', role_id: 'role:typed-owner', membership_id: 'membership:old', version: 2, role_kind: 'owner' }]);
      if (text.includes('from access.membership where id=any'))
        return result([
          { id: 'membership:new', organization_id: 'tenant:one', client: 'operator', status: 'active', access_version: 7 },
          { id: 'membership:old', organization_id: 'tenant:one', client: 'operator', status: 'active', access_version: 4 },
        ]);
      if (text.includes('update access.membershiprole')) return result([{ membership_id: 'membership:old' }]);
      if (text.includes('update access.ownership')) return result([{ scope_id: 'tenant:one' }]);
      return result([]);
    });
    const bump = vi.fn(async (_database: OperationDatabase, membership: string) => (membership === 'membership:old' ? 5 : 8));
    const versions = { bump } as unknown as AccessVersionService;
    const command = new TransferOwner(new PgAccessRepository(), versions);
    const response = await command.execute(request(), { query } as unknown as OperationDatabase);

    const lock = query.mock.calls.find(([sql]) => sql.includes('from access.membership where id=any'));
    expect(lock?.[1]).toEqual([['membership:new', 'membership:old']]);
    expect(bump.mock.calls.map((call) => call[1])).toEqual(['membership:new', 'membership:old']);
    expect(response).toEqual({ status: 200, body: { scope: 'tenant:one', previousMembership: 'membership:old', membership: 'membership:new', previousAccessVersion: 5, accessVersion: 8, version: 3 } });
    expect(query.mock.calls.some(([sql]) => sql.includes("'access.owner.transferred'"))).toBe(true);
  });
});

function request(): OperationRequest {
  return {
    type: 'access.owners.transfer',
    input: {
      path: {},
      query: {},
      headers: {},
      body: { targetMembership: 'membership:new', targetVersion: 7, reason: 'planned ownership rotation' },
      rawBody: '',
      deadline: Date.now() + 1000,
      signal: new AbortController().signal,
      expectedVersion: 4,
      idempotency: 'owner-transfer',
    },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:owner', session: 'session:owner', membership: 'membership:old', credentialVersion: 1, accessVersion: 4, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:old', active: true, accessVersion: 4, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
        organization: 'tenant:one',
        scope: { id: 'tenant:one', kind: 'tenant', path: [] },
        accessVersion: 4,
        capabilities: new Set(),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:owner',
      },
    },
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
