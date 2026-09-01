import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgSessionSecurity } from '../infrastructure/persistence/PgSessionSecurity';
import { withWriteTransaction } from '../../../test/TransactionFixture';

describe('PgSessionSecurity', () => {
  it('increments the version and revokes every active session for a confirmed risk event', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult);

    await withWriteTransaction(query, (context) => new PgSessionSecurity().invalidate(context, 'principal:one', 'risk_event'));

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('credential_version=credential_version+1');
    expect(query.mock.calls[0]?.[1]).toEqual(['principal:one']);
    expect(query.mock.calls[1]?.[0]).toContain('revoked_reason=$2');
    expect(query.mock.calls[1]?.[1]).toEqual(['principal:one', 'risk_event']);
  });
});
