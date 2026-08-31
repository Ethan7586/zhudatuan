import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';

describe('access governance outbox persistence', () => {
  it('gives polymorphic membership activation payload parameters explicit database types', async () => {
    let sql = '';
    const database: OperationDatabase = {
      query: async (text: string) => {
        sql = text;
        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      },
    };
    await new PgAccessGovernanceRepository().membershipActivated(database, {
      change: { membership: 'membership:one', organization: 'mall:one', version: 2 },
      invitation: 'invitation:one',
      target: 'storefront',
      grantDigest: 'a'.repeat(64),
      trace: 'trace:one',
    });
    expect(sql).toContain("'membershipId',$1::text");
    expect(sql).toContain("'accessVersion',$3::bigint");
    expect(sql).toContain("'invitationId',$5::text");
    expect(sql).toContain("'target',$6::text");
    expect(sql).toContain("'grantDigest',$7::text");
  });
});
