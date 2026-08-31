import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../application/OperationExecution';
import { MakerCheckerPolicy } from './MakerCheckerPolicy';

function request(proof?: string): OperationRequest {
  return {
    type: 'access.roles.manage',
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:maker', session: 'session:maker', membership: 'membership:maker', credentialVersion: 3, accessVersion: 7, target: 'console', assurance: { level: 3, verified: new Date() } },
        membership: { id: 'membership:maker', active: true, accessVersion: 7, permissions: { allows: new Set(['access.role.manage']), denies: new Set() }, scopes: [] },
        organization: 'tenant:1',
        scope: { kind: 'tenant', id: 'tenant:1', tenant: 'tenant:1', path: [] },
        accessVersion: 7,
        capabilities: new Set(['access.roles.manage']),
        capabilityVersion: 2,
        assurance: { level: 3, verified: new Date() },
        trace: 'trace:maker',
      },
    },
    input: {
      path: { roleid: 'role:1' },
      query: {},
      headers: proof ? { 'x-action-proof': proof } : {},
      body: { name: 'operator', permissions: ['order.read'] },
      rawBody: '',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'idempotency:1',
      expectedVersion: 4,
    },
  };
}

describe('MakerCheckerPolicy', () => {
  it('binds the one-time proof to the canonical request and never sends plaintext to PostgreSQL', async () => {
    const query = vi.fn(async () => ({ rows: [{ proof_id: 'proof:1', checker_membership_id: 'membership:checker' }], rowCount: 1 }) as unknown as QueryResult);
    const token = 'p'.repeat(43);
    await new MakerCheckerPolicy().consume({ query } as never, request(token));
    const values = (query.mock.calls[0] as unknown as [string, readonly unknown[]])[1];
    expect(values).toHaveLength(9);
    expect(values).not.toContain(token);
    expect(values.slice(1)).toEqual(expect.arrayContaining(['access.roles.manage', 'role:1', 4, 'console', 'tenant:1', 'membership:maker', 'access.role.manage']));
  });

  it('fails closed before database access when a marked operation has no proof', async () => {
    const query = vi.fn();
    await expect(new MakerCheckerPolicy().consume({ query } as never, request())).rejects.toThrow('ACTION_PROOF_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('maps database proof rejection to the declared public domain error', async () => {
    const query = vi.fn(async () => {
      throw Object.assign(new Error('ACTION_PROOF_REPLAYED'), { code: 'P0001' });
    });
    await expect(new MakerCheckerPolicy().consume({ query } as never, request('p'.repeat(43)))).rejects.toMatchObject({ code: 'ACTION_PROOF_REPLAYED' });
  });
});
