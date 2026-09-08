import { describe, expect, it, vi } from 'vitest';
import { withWriteTransaction, result } from '../../../test/TransactionFixture';
import type { AuditRecord } from '../domain/model/AuditRecord';
import { RecordAudit } from '../application/service/RecordAudit';

describe('canonical audit command', () => {
  it('redacts secrets from reason, before/after and evidence before repository append', async () => {
    let appended: AuditRecord | undefined;
    const repository = {
      previous: vi.fn(async () => null),
      appendRecord: vi.fn(async (_context, record: AuditRecord) => {
        appended = record;
      }),
    };
    const audit = new RecordAudit(repository as never);
    await withWriteTransaction(
      async () => result([]),
      (context) =>
        audit.record(context, {
          actor: 'actor:one',
          actorType: 'console',
          scope: 'mall:one',
          request: 'request:one',
          operation: 'catalog.listings.publish',
          subject: { type: 'actor', id: 'actor:one' },
          object: { type: 'catalog', id: 'listing:one' },
          outcome: 'succeeded',
          reason: 'Bearer reason-secret',
          before: { password: 'before-secret' },
          after: { authorization: 'after-secret' },
          evidence: { token: 'evidence-secret', safe: 'approved' },
          trace: 'trace:one',
        }),
      'catalog.listings.publish'
    );
    const serialized = JSON.stringify(appended);
    expect(serialized).not.toContain('reason-secret');
    expect(serialized).not.toContain('before-secret');
    expect(serialized).not.toContain('after-secret');
    expect(serialized).not.toContain('evidence-secret');
    expect(serialized).toContain('approved');
  });
});
