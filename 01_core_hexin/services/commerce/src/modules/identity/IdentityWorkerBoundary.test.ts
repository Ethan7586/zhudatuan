import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { AccessPort } from '../access/AccessPort';
import { MemberPort } from '../member/MemberPort';
import { IdentityRetentionPort } from './IdentityRetentionPort';
import { PgIdentityPrincipal } from './infrastructure/PgIdentityPrincipal';

describe('shopjob identity authority boundary', () => {
  it('uses only narrow retention and import functions', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => result());
    const database = { query } as unknown as OperationDatabase;

    await new IdentityRetentionPort().purge(database);
    await new PgIdentityPrincipal().ensurePending(database, 'principal:import:hash');
    await new MemberPort().ensureImported(database, {
      member: 'member:import:hash', principal: 'principal:import:hash', display: 'Imported member', status: 'pending',
    });
    await new AccessPort().ensureImported(database, {
      membership: 'membership:import:hash:operator', member: 'member:import:hash', organization: 'tenant:one',
      client: 'operator', employee: 'employee:one',
    });

    expect(query.mock.calls).toEqual([
      ['select identity.purge_expired_job_records()'],
      ['select identity.ensure_imported_principal($1)', ['principal:import:hash']],
      ['select member.ensure_imported_profile($1,$2,$3)', ['member:import:hash', 'principal:import:hash', 'Imported member']],
      ['select access.ensure_imported_membership($1,$2,$3,$4,$5)',
        ['membership:import:hash:operator', 'member:import:hash', 'tenant:one', 'operator', 'employee:one']],
    ]);
    expect(query.mock.calls.map(([sql]) => sql).join('\n')).not.toMatch(
      /(?:insert\s+into|update|delete\s+from)\s+(?:identity\.(?:session|principal)|member\.profile|access\.membership)/i,
    );
  });
});

function result(): QueryResult {
  return { rows: [], rowCount: 0 } as unknown as QueryResult;
}
