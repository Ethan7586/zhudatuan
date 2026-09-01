import { describe, expect, it, vi } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { CleanupInvitations } from '../../application/process/CleanupInvitations';
import { PgInvitationCleanupRepository } from '../../infrastructure/persistence/PgInvitationCleanupRepository';
import { InvitationCleanupJob } from './InvitationCleanupJob';

describe('InvitationCleanupJob', () => {
  it('expires every active claim state so proved claims cannot retain invitation capacity', async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        statements.push(text);
        if (text.includes('select count(*)::text count from deleted')) return result([{ count: '0' }]);
        return result([]);
      }),
      release: vi.fn(),
    } as unknown as PoolClient;
    const query: DatabasePool['query'] = async () => result([{ count: '0' }]) as never;
    const pool: DatabasePool = { connect: async () => client, query, workload: () => pool, end: async () => undefined };
    const metrics = { count: vi.fn(), duration: vi.fn() };
    const processor = new InvitationCleanupJob(new CleanupInvitations(new PgTransactionManager(pool), new PgInvitationCleanupRepository(), { metrics } as never, 20));
    await processor.process({ id: 'job:cleanup', kind: 'invitationcleanup', payload: { traceId: 'trace:cleanup' }, attempts: 1 } as never, new AbortController().signal);
    const claim = statements.find((statement) => statement.includes('update identity.invitationclaim'));
    expect(claim).toContain("state in('reserved','proofpending','proved')");
    expect(metrics.count).toHaveBeenCalledWith('identity_invitation_cleanup_total', 0, expect.objectContaining({ result: 'success' }));
  });
});

function result<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { rows, command: '', rowCount: rows.length, oid: 0, fields: [] };
}
