import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface MembershipReadPort {
  member(scope: ReadScope, membership: string): Promise<string | null>;
}

interface MembershipRow extends QueryResultRow {
  readonly member_id: string;
}

export class PgMembershipReadPort implements MembershipReadPort {
  private readonly reads: ReadSession;

  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }

  member(scope: ReadScope, membership: string): Promise<string | null> {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<MembershipRow>(`select member_id from access.membership where id=$1 and client='storefront' and status='active'`, [membership]);
      return result.rows[0]?.member_id ?? null;
    });
  }
}

export const MEMBERSHIP_READ_PORT = publicPort<MembershipReadPort>('access', 'membershipread');
