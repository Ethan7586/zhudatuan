import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface MemberSummary {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly version: number;
}

export interface MemberReadPort {
  summary(scope: ReadScope, member: string): Promise<MemberSummary | null>;
}

interface MemberRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly status: string;
  readonly version: number;
}

export class PgMemberReadPort implements MemberReadPort {
  private readonly reads: ReadSession;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }
  summary(scope: ReadScope, member: string): Promise<MemberSummary | null> {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<MemberRow>(`select id,display_name,status,version from member.profile where id=$1 and status='active'`, [member]);
      const row = result.rows[0];
      return row ? Object.freeze({ id: row.id, displayName: row.display_name, status: row.status, version: Number(row.version) }) : null;
    });
  }
}

export const MEMBER_READ_PORT = publicPort<MemberReadPort>('member', 'read');
