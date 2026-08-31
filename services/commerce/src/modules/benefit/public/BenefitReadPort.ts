import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface BenefitSummary {
  readonly accounts: number;
  readonly availableMinor: number;
  readonly currency: string | null;
  readonly version: number;
}

export interface BenefitReadPort {
  summary(scope: ReadScope, member: string, mall: string): Promise<BenefitSummary>;
}

interface BenefitRow extends QueryResultRow {
  readonly accounts: number;
  readonly available_minor: number;
  readonly currency: string | null;
  readonly version: number;
}

export class PgBenefitReadPort implements BenefitReadPort {
  private readonly reads: ReadSession;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }
  summary(scope: ReadScope, member: string, mall: string): Promise<BenefitSummary> {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<BenefitRow>(
        `select count(*)::integer accounts,coalesce(sum(greatest(0,balance.balance_minor)),0)::bigint available_minor,
        min(account.currency) currency,coalesce(max(account.version),0)::bigint version
        from benefit.account account join benefit.balance balance on balance.account_id=account.id
        where account.member_id=$1 and account.scope_id=$2 and account.status='active'`,
        [member, mall]
      );
      const row = result.rows[0]!;
      return Object.freeze({ accounts: Number(row.accounts), availableMinor: Number(row.available_minor), currency: row.currency, version: Number(row.version) });
    });
  }
}

export const BENEFIT_READ_PORT = publicPort<BenefitReadPort>('benefit', 'read');
