import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Assignment, AssignmentRepository } from '../../application/port/AssignmentRepository';
interface AssignmentRow extends Omit<Assignment, 'effectiveAt' | 'expiresAt'> {
  readonly effectiveAt: Date | string;
  readonly expiresAt: Date | string | null;
}
export class PgAssignmentRepository implements AssignmentRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async list(context: ReadTransactionContext, input: Parameters<AssignmentRepository['list']>[1]): Promise<readonly Assignment[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<AssignmentRow>(
      `select entitlement.id,entitlement.scope_id "scopeId",capability.id "capabilityId",capability.name,
       entitlement.state,entitlement.quota,entitlement.effective_at "effectiveAt",entitlement.expires_at "expiresAt",entitlement.version
       from capability.entitlement entitlement join capability.capability capability on capability.id=entitlement.capability_id
       where entitlement.scope_id=$1 and ($2::text is null or (capability.name,entitlement.id)>($2,$3))
       order by capability.name,entitlement.id limit $4`,
      [input.scope, input.sort, input.id, input.fetch]
    );
    return result.rows.map(assignment);
  }
  async save(context: WriteTransactionContext, input: Parameters<AssignmentRepository['save']>[1]): Promise<Assignment | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<AssignmentRow>(
      `insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
       values($1,$2,$3,$4,$5,clock_timestamp(),$6,0) on conflict(id) do update set state=excluded.state,quota=excluded.quota,
       expires_at=excluded.expires_at,version=capability.entitlement.version+1
       where capability.entitlement.scope_id=$2 and ($7::bigint is null or capability.entitlement.version=$7)
       returning id,scope_id "scopeId",capability_id "capabilityId",state,quota,effective_at "effectiveAt",expires_at "expiresAt",version`,
      [input.id, input.scope, input.capability, input.state, input.quota, input.expiresAt, input.expectedVersion]
    );
    return result.rows[0] ? assignment(result.rows[0]) : null;
  }
}
function assignment(row: AssignmentRow): Assignment {
  return Object.freeze({ ...row, effectiveAt: utc(row.effectiveAt), expiresAt: row.expiresAt === null ? null : utc(row.expiresAt) });
}
function utc(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('CAPABILITY_TIME_INVALID');
  return date.toISOString();
}
