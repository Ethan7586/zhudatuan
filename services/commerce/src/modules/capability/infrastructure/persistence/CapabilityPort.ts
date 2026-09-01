import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { EntitlementInput } from '../../public/Entitlement';
export class CapabilityPort {
  private readonly transactions = new PgTransactionAccess();
  async save(context: WriteTransactionContext, input: EntitlementInput) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      scopeId: string;
      capabilityId: string;
      state: 'enabled' | 'disabled';
      quota: number | null;
      effectiveAt: string;
      expiresAt: string | null;
      version: number;
    }>(
      `insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
      values($1,$2,$3,$4,$5,clock_timestamp(),$6,0) on conflict(id) do update set state=excluded.state,quota=excluded.quota,
      expires_at=excluded.expires_at,version=capability.entitlement.version+1 where capability.entitlement.scope_id=$2
      and ($7::bigint is null or capability.entitlement.version=$7)
      returning id,scope_id "scopeId",capability_id "capabilityId",state,quota,effective_at "effectiveAt",expires_at "expiresAt",version::integer`,
      [input.id, input.scope, input.capability, input.state, input.quota, input.expiresAt, input.expectedVersion]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
}
