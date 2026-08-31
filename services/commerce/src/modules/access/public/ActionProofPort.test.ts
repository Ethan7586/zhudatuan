import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { PgActionProofPort, type ActionProofBinding, type ActionProofChecker } from './ActionProofPort';
import type { AuthorizationPort, AuthorizationSnapshot } from './AuthorizationPort';

const binding: ActionProofBinding = Object.freeze({
  operation: 'referral.settings.manage',
  resource: 'referralsetting:one',
  requestHash: 'a'.repeat(64),
  expectedVersion: 3,
  makerMembership: 'membership:maker',
});
const checker: ActionProofChecker = Object.freeze({ membership: 'membership:checker', target: 'console', accessVersion: 9 });

describe('PgActionProofPort', () => {
  it('issues an opaque five-minute proof only after both actors are authorized for the exact action', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ expires_at: '2026-08-30T10:05:00.000Z' }] });
    const authorizations = port(snapshot(checker.membership, checker.accessVersion), snapshot(binding.makerMembership, 4));

    const issued = await new PgActionProofPort(authorizations).issue({ query } as OperationDatabase, binding, checker);

    expect(issued).toEqual({ proof: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expiresAt: '2026-08-30T10:05:00.000Z' });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('access.issue_action_proof'), expect.arrayContaining([binding.operation, binding.resource, binding.requestHash, binding.expectedVersion]));
  });

  it('rejects self-approval before any database access', async () => {
    const query = vi.fn();
    await expect(new PgActionProofPort(port()).validate({ query } as OperationDatabase, binding, { ...checker, membership: binding.makerMembership })).rejects.toMatchObject({ code: 'MAKER_CHECKER_SEPARATION_REQUIRED' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects mismatched maker and checker resource scopes', async () => {
    const query = vi.fn();
    const authorizations = port(snapshot(checker.membership, checker.accessVersion), { ...snapshot(binding.makerMembership, 4), resource: { kind: 'mall', id: 'mall:other', path: [] } });
    await expect(new PgActionProofPort(authorizations).validate({ query } as OperationDatabase, binding, checker)).rejects.toMatchObject({ code: 'ACTION_PROOF_INVALID' });
  });
});

function snapshot(membership: string, accessVersion: number): AuthorizationSnapshot {
  return {
    membership,
    active: true,
    accessVersion,
    credentialVersion: 1,
    organization: 'enterprise:one',
    target: 'console',
    roles: [],
    allows: ['referral.setting.manage'],
    denies: [],
    scopes: [],
    operations: [binding.operation],
    resource: { kind: 'mall', id: 'mall:one', path: [] },
    capabilityVersion: 1,
  };
}

function port(...values: readonly AuthorizationSnapshot[]): AuthorizationPort {
  let index = 0;
  return { read: vi.fn().mockImplementation(() => Promise.resolve(values[index++] ?? null)) };
}
