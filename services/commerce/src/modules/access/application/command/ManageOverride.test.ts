import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import { AccessVersionService } from '../service/AccessVersionService';
import { ManageOverride } from './ManageOverride';
import { PgAccessRepository } from '../../infrastructure/persistence/PgAccessRepository';

describe('ManageOverride', () => {
  it('sets a delegatable permission and bumps the target AccessVersion exactly once', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async (text) => {
      if (text.includes('from access.membership membership')) return result([{ id: 'membership:target', organization_id: 'tenant:one', client: 'operator', status: 'active', access_version: 8, owner: false }]);
      if (text.includes('insert into access.membershipoverride')) return result([{ effect: 'deny', expires_at: null }]);
      return result([]);
    });
    const bump = vi.fn(async () => 9);
    const command = new ManageOverride(new PgAccessRepository(), { bump } as unknown as AccessVersionService);
    const response = await command.execute(request({ action: 'set', targetMembership: 'membership:target', permission: 'order.read', effect: 'deny', reason: 'temporary separation of duties' }), { query } as unknown as OperationDatabase);
    expect(response).toEqual({ status: 200, body: { targetMembership: 'membership:target', permission: 'order.read', effect: 'deny', expiresAt: null, revoked: false, accessVersion: 9 } });
    expect(bump).toHaveBeenCalledOnce();
    expect(bump).toHaveBeenCalledWith(expect.anything(), 'membership:target', 'overridechanged', 'trace:override');
  });

  it('rejects changes to an owner membership', async () => {
    const query = vi.fn(async () => result([{ id: 'membership:target', organization_id: 'tenant:one', client: 'operator', status: 'active', access_version: 8, owner: true }]));
    const repository = new PgAccessRepository();
    await expect(
      new ManageOverride(repository, new AccessVersionService(repository)).execute(request({ action: 'revoke', targetMembership: 'membership:target', permission: 'order.read', reason: 'ordinary override must not alter owner' }), {
        query,
      } as unknown as OperationDatabase)
    ).rejects.toMatchObject({ code: 'OWNER_TRANSFER_REQUIRED' });
  });
});

function request(body: Readonly<Record<string, unknown>>): OperationRequest {
  return {
    type: 'access.overrides.manage',
    input: { path: {}, query: {}, headers: {}, body, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal, expectedVersion: 8, idempotency: 'override-change' },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:admin', session: 'session:admin', membership: 'membership:admin', credentialVersion: 1, accessVersion: 4, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:admin', active: true, accessVersion: 4, permissions: { allows: new Set(['access.override.manage', 'order.read']), denies: new Set() }, scopes: [] },
        organization: 'tenant:one',
        scope: { id: 'tenant:one', kind: 'tenant', path: [] },
        accessVersion: 4,
        capabilities: new Set(['access.overrides.manage']),
        capabilityVersion: 1,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:override',
      },
    },
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
