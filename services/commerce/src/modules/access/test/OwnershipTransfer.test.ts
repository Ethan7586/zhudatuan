import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { OwnershipTransfer } from '../domain/model/OwnershipTransfer';
import { Role } from '../domain/model/Role';
import { SeparationPolicy } from '../domain/policy/SeparationPolicy';
import { ManageOwnershipTransfer } from '../application/process/ManageOwnershipTransfer';
import { OwnershipExpiryJob } from '../interface/job/OwnershipExpiryJob';

const sourceProof = 'a'.repeat(64);
const targetProof = 'b'.repeat(64);
const cancelProof = 'c'.repeat(64);
const now = new Date('2026-09-04T12:00:00.000Z');

describe('access ownership transfer', () => {
  it('requires source submission and independent target confirmation', () => {
    const pending = draft().submit(sourceProof);
    expect(pending.state).toBe('pending');
    expect(() => pending.accept('membership:source', targetProof, now)).toThrow('OWNER_TRANSFER_STATE_INVALID');
    expect(() => pending.accept('membership:target', sourceProof, now)).toThrow('OWNER_TRANSFER_STATE_INVALID');
    const accepted = pending.accept('membership:target', targetProof, now);
    expect(accepted).toMatchObject({ state: 'accepted', sourceProof, targetProof, version: 3 });
  });

  it('makes accept and cancel terminal so a stale competing action cannot win', () => {
    const accepted = draft().submit(sourceProof).accept('membership:target', targetProof, now);
    expect(() => accepted.cancel('membership:source', cancelProof, now)).toThrow('OWNER_TRANSFER_STATE_INVALID');
    const cancelled = draft().submit(sourceProof).cancel('membership:source', cancelProof, now);
    expect(() => cancelled.accept('membership:target', targetProof, now)).toThrow('OWNER_TRANSFER_STATE_INVALID');
    expect(cancelled).toMatchObject({ state: 'cancelled', cancelProof });
  });

  it('expires a pending transfer and rejects acceptance after its deadline', () => {
    const pending = draft(new Date('2026-09-04T01:00:00.000Z')).submit(sourceProof);
    expect(pending.current(new Date('2026-09-04T01:00:00.001Z')).state).toBe('expired');
    expect(() => pending.accept('membership:target', targetProof, new Date('2026-09-04T01:00:00.001Z'))).toThrow('OWNER_TRANSFER_EXPIRED');
  });

  it('keeps acceptance closed during the 24-hour cooling period', () => {
    const pending = new OwnershipTransfer({
      id: 'ownershiptransfer:cooling', scope: 'mall:one', role: 'role:owner', sourceMembership: 'membership:source', targetMembership: 'membership:target',
      formerOwnerMode: 'retain_admin', formerOwnerRole: 'role:operator', formerOwnerRoleVersion: 3, ownershipVersion: 5, targetAccessVersion: 9,
      sourceProof: null, targetProof: null, cancelProof: null, state: 'draft', version: 1,
      coolingUntil: new Date('2026-09-05T00:00:00.000Z'), expiresAt: new Date('2026-09-11T00:00:00.000Z'),
    }).submit(sourceProof);
    expect(() => pending.accept('membership:target', targetProof, new Date('2026-09-04T23:59:59.999Z'))).toThrow('OWNER_TRANSFER_COOLING_PERIOD');
    expect(pending.accept('membership:target', targetProof, new Date('2026-09-05T00:00:00.000Z')).state).toBe('accepted');
  });

  it('rejects self review and conflicting financial, voucher and refund duties', () => {
    const policy = new SeparationPolicy();
    expect(() => policy.assertActors('membership:one', 'membership:one')).toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
    const rules = [
      { left: 'finance.settlement.decide', right: 'finance.withdrawal.decide' },
      { left: 'voucher.credential.manage', right: 'voucher.issue.manage' },
      { left: 'finance.repair.decide', right: 'payment.refund' },
    ];
    for (const { left, right } of rules) {
      expect(() => policy.assertPermissions(rules, [left, right])).toThrow('ACCESS_SEPARATION_REQUIRED');
      expect(() => policy.assertPermissions(rules, [left, right], [right])).not.toThrow();
    }
  });

  it('computes role changes with explicit deny and people/scope impact', () => {
    const role = new Role({ id: 'role:one', scope: 'mall:one', name: '运营', status: 'active', version: 2, kind: 'custom' });
    expect(role.permissionDiff({ allows: ['order.read'], denies: [] }, { allows: ['catalog.read'], denies: ['order.read'] }, { people: 18, scopes: 4 })).toEqual({
      addedAllows: ['catalog.read'], removedAllows: ['order.read'], addedDenies: ['order.read'], removedDenies: [], affectedPeople: 18, affectedScopes: 4,
    });
  });

  it('returns a non-persistent draft preview with complete impact data', async () => {
    const repository = {
      lockOwnership: vi.fn(async () => ({ scope: 'mall:one', role: 'role:owner', membership: 'membership:test', version: 5, roleKind: 'owner' })),
      lockMembers: vi.fn(async () => [
        { id: 'membership:test', organization: 'mall:one', client: 'console', status: 'active', accessVersion: 6, mobileReady: true },
        { id: 'membership:target', organization: 'mall:one', client: 'console', status: 'active', accessVersion: 9, mobileReady: true },
      ]),
      activeTransfer: vi.fn(async () => false),
      roleVersion: vi.fn(async () => 3),
      impact: vi.fn(async () => ({ people: 2, scopes: 7 })),
    };
    const transaction = {} as WriteTransactionContext;
    const context = { ...readHandlerContext('access.ownership.transfers.preview', transaction), transaction, expectedVersion: 5 } as WriteHandlerContext<'access.ownership.transfers.preview'>;
    const preview = await new ManageOwnershipTransfer(repository as never, () => new Date('2026-09-04T00:00:00.000Z')).previewCreate(
      { body: { targetMembership: 'membership:target', targetAccessVersion: 9, formerOwnerMode: 'retain_admin', formerOwnerRole: 'role:operator', reason: '负责人岗位调整' } },
      context
    );
    expect(preview).toMatchObject({ state: 'draft', affectedPeople: 2, affectedScopes: 7, ownershipVersion: 5, targetAccessVersion: 9, formerOwnerRoleVersion: 3, coolingUntil: '2026-09-05T00:00:00.000Z', expiresAt: '2026-09-11T00:00:00.000Z' });
    expect(repository).not.toHaveProperty('create.mock.calls.0');
  });

  it('keeps a Chinese permission search projection and GIN index in the migration contract', async () => {
    const sql = await readFile(new URL('../../../../../../database/migrations/20260904013000_prepare_access_ownership.sql', import.meta.url), 'utf8');
    expect(sql).toContain('name_zh text not null');
    expect(sql).toContain("'查看所有权'");
    expect(sql).toContain('access_permission_search');
    expect(sql).toContain("to_tsvector('simple',search_text)");
  });

  it('routes the scheduled expiry job to the exact transfer and trace', async () => {
    const execute = vi.fn(async () => undefined);
    const job = new OwnershipExpiryJob({ execute } as never);
    const signal = new AbortController().signal;
    await job.process(
      { id: 'job:ownershipexpiry:one', kind: 'ownershipexpiry', scope: 'mall:one', payload: { transfer: 'ownershiptransfer:one', scope: 'mall:one', traceId: 'trace:one' }, attempts: 1 } as never,
      signal,
      1_800_000_000_000
    );
    expect(execute).toHaveBeenCalledWith({ job: 'job:ownershipexpiry:one', transfer: 'ownershiptransfer:one', scope: 'mall:one', trace: 'trace:one', signal, deadline: 1_800_000_000_000 });
  });
});

function draft(expiresAt = new Date('2026-09-05T00:00:00.000Z')): OwnershipTransfer {
  return new OwnershipTransfer({
    id: 'ownershiptransfer:one', scope: 'mall:one', role: 'role:owner', sourceMembership: 'membership:source', targetMembership: 'membership:target',
    formerOwnerMode: 'remove_admin', formerOwnerRole: null, formerOwnerRoleVersion: null, ownershipVersion: 5, targetAccessVersion: 9,
    sourceProof: null, targetProof: null, cancelProof: null, state: 'draft', version: 1,
    coolingUntil: new Date(expiresAt.getTime() - 8 * 24 * 60 * 60_000), expiresAt,
  });
}
