import { describe, expect, it } from 'vitest';
import { AccessRecord } from './AccessRecord';
import { AuditRecord, canonical } from './AuditRecord';

const write = { scope:'mall:1', actor:'principal:1', actorType:'console', action:'catalog.listings.publish', resourceType:'catalog',
  resource:'listing:1', before:{ status:'draft' }, after:{ status:'published' }, evidence:{ reason:'approved' }, trace:'trace:1' } as const;

describe('Audit integrity records', () => {
  it('canonicalizes object keys and chains command hashes deterministically', () => {
    expect(canonical({ b:2, a:1 })).toBe(canonical({ a:1, b:2 }));
    const first = new AuditRecord('audit:00000000-0000-4000-8000-000000000001',write,write.evidence,null,'2026-08-21T00:00:00.000Z');
    const repeated = new AuditRecord(first.id,write,write.evidence,null,first.recordedAt);
    const second = new AuditRecord('audit:00000000-0000-4000-8000-000000000002',{...write,after:{status:'retired'}},
      write.evidence,first.recordHash,'2026-08-21T00:00:01.000Z');
    expect(first.recordHash).toBe(repeated.recordHash);
    expect(second.previousHash).toBe(first.recordHash);
    expect(second.recordHash).not.toBe(first.recordHash);
  });

  it('includes sensitive read metadata in the same integrity chain', () => {
    const command = new AuditRecord('audit:00000000-0000-4000-8000-000000000003',write,write.evidence,null,'2026-08-21T00:00:00.000Z');
    const access = new AccessRecord('access:00000000-0000-4000-8000-000000000004', { scope:'mall:1', actor:'principal:1',
      actorType:'console', resourceType:'member', resource:'member:1', fields:{ projection:['id'] }, purpose:'member.profile.read',
      trace:'trace:2' }, { projection:['id'] }, command.recordHash, '2026-08-21T00:00:01.000Z');
    expect(access.previousHash).toBe(command.recordHash);
    expect(access.recordHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
