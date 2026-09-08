import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';
import { withWriteTransaction } from '../../../../test/TransactionFixture';

describe('access governance outbox persistence', () => {
  it('expires stale pending transfers atomically and emits one versioned event for every transfer', async () => {
    const statements: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const query = async (sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes('with expired as')) {
        return {
          rows: [
            {
              active: false,
              expired: [{ id: 'transfer:one', tenant: 'tenant:test', scope: 'mall:one', sourceMembership: 'membership:source', targetMembership: 'membership:target', version: 3 }],
            },
          ],
          rowCount: 1,
        } as unknown as QueryResult;
      }
      return { rows: [], rowCount: 1 } as unknown as QueryResult;
    };

    const active = await withWriteTransaction(query, (context) => new PgAccessGovernanceRepository().activeTransfer(context, 'mall:one', 'trace:expiry'));

    expect(active).toBe(false);
    expect(statements[0]?.sql).toContain("state='expired'");
    expect(statements[0]?.sql).toContain('insert into access.ownershiptimeline');
    const event = statements.find(({ sql }) => sql.includes('insert into runtime.outbox'));
    expect(event?.values[1]).toBe('access.owner.transfer.expired');
    expect(event?.values[4]).toBe('transfer:one');
    expect(event?.values[5]).toBe('mall:one');
    expect(JSON.parse(String(event?.values[6]))).toEqual({
      transfer: 'transfer:one',
      scope: 'mall:one',
      sourceMembership: 'membership:source',
      targetMembership: 'membership:target',
      version: 3,
    });
    expect(event?.values[7]).toBe('trace:expiry');
  });

  it('gives polymorphic membership activation payload parameters explicit database types', async () => {
    let sql = '';
    let values: readonly unknown[] = [];
    const query = async (text: string, parameters: readonly unknown[] = []) => {
      sql = text;
      values = parameters;
      return { rows: [], rowCount: 0 } as unknown as QueryResult;
    };
    await withWriteTransaction(query, (context) =>
      new PgAccessGovernanceRepository().membershipActivated(context, {
        change: { membership: 'membership:one', organization: 'mall:one', version: 2 },
        invitation: 'invitation:one',
        target: 'storefront',
        grantDigest: 'a'.repeat(64),
        trace: 'trace:one',
      })
    );
    expect(sql).toContain('$7::jsonb');
    expect(JSON.parse(String(values[6]))).toEqual({
      membershipId: 'membership:one',
      accessVersion: 2,
      invitationId: 'invitation:one',
      target: 'storefront',
      grantDigest: 'a'.repeat(64),
    });
  });
});
