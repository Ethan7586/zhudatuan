import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';
import { withWriteTransaction } from '../../../../test/TransactionFixture';

describe('access governance outbox persistence', () => {
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
