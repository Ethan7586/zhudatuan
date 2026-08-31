import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { PolicyRepository } from '../../domain/repository/PolicyRepository';

export class PgPolicyRepository implements PolicyRepository {
  constructor(private readonly database: OperationDatabase) {}

  read(scopeIds: readonly string[], status: string | null, cursor: string | null, limit: number) {
    return this.database.query(
      `select id,name,state status,trigger,entries,"effective_at" "effectiveAt","expires_at" "expiresAt",version
      from finance.policy where scope_id=any($1::text[]) and ($2::text is null or state=$2)
      and ($3::text is null or id>$3) order by id limit $4`,
      [scopeIds, status, cursor, limit]
    );
  }

  async affected(scopeIds: readonly string[], from: string, to: string): Promise<number> {
    const result = await this.database.query<{ count: number }>(`select count(*)::float8 count from finance.journal where scope_id=any($1::text[]) and posted_at>=$2 and posted_at<$3`, [scopeIds, from, to]);
    return result.rows[0]?.count ?? 0;
  }
}
