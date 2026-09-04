import { describe, expect, it } from 'vitest';
import { AccessRecord } from './AccessRecord';
import { AuditRecord, canonical } from './AuditRecord';

const write = {
  scope: 'mall:1',
  actor: 'principal:1',
  actorType: 'console',
  request: 'request:1',
  operation: 'catalog.listings.publish',
  subject: { type: 'member', id: 'principal:1' },
  object: { type: 'catalog', id: 'listing:1' },
  outcome: 'succeeded',
  reason: 'approved',
  before: { status: 'draft' },
  after: { status: 'published' },
  evidence: { reason: 'approved' },
  trace: 'trace:1',
} as const;

describe('Audit integrity records', () => {
  it('canonicalizes object keys and chains command hashes deterministically', () => {
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }));
    const first = new AuditRecord('audit:00000000-0000-4000-8000-000000000001', write, write.evidence, null, '2026-08-21T00:00:00.000Z');
    const repeated = new AuditRecord(first.id, write, write.evidence, null, first.recordedAt);
    const second = new AuditRecord('audit:00000000-0000-4000-8000-000000000002', { ...write, after: { status: 'retired' } }, write.evidence, first.recordHash, '2026-08-21T00:00:01.000Z');
    expect(first.recordHash).toBe(repeated.recordHash);
    expect(second.previousHash).toBe(first.recordHash);
    expect(second.recordHash).not.toBe(first.recordHash);
    expect(new AuditRecord(first.id, { ...write, request: 'request:changed' }, write.evidence, null, first.recordedAt).recordHash).not.toBe(first.recordHash);
    expect(Object.isFrozen(first.input)).toBe(true);
    expect(Object.isFrozen(first.input.before)).toBe(true);
    expect(() => Object.assign(first.input.before as object, { status: 'forged' })).toThrow();
  });

  it('includes sensitive read metadata in the same integrity chain', () => {
    const command = new AuditRecord('audit:00000000-0000-4000-8000-000000000003', write, write.evidence, null, '2026-08-21T00:00:00.000Z');
    const access = new AccessRecord(
      'access:00000000-0000-4000-8000-000000000004',
      { scope: 'mall:1', actor: 'principal:1', actorType: 'console', request: 'request:2', operation: 'member.profile.read', subject: { type: 'member', id: 'principal:1' }, object: { type: 'member', id: 'member:1' }, outcome: 'succeeded', reason: 'profile support', fields: { projection: ['id'] }, trace: 'trace:2' },
      { projection: ['id'] },
      command.recordHash,
      '2026-08-21T00:00:01.000Z'
    );
    expect(access.previousHash).toBe(command.recordHash);
    expect(access.recordHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
