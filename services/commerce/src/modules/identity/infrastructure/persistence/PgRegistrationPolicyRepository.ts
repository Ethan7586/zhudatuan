import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { RegistrationPolicyRecord, RegistrationPolicyRepository } from '../../application/port/RegistrationPolicyRepository';
export class PgRegistrationPolicyRepository implements RegistrationPolicyRepository {
  private readonly transactions = new PgTransactionAccess();
  async current(context: ReadTransactionContext): Promise<RegistrationPolicyRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RegistrationPolicyRecord>(`select id,terms_title,terms_body,privacy_title,privacy_body,terms_hash
      from identity.registrationpolicy where effective_at<=clock_timestamp()
      and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
    return freeze(result.rows[0]);
  }
  async read(context: ReadTransactionContext, id: string, active: boolean): Promise<RegistrationPolicyRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RegistrationPolicyRecord>(
      `select id,terms_title,terms_body,privacy_title,privacy_body,terms_hash
      from identity.registrationpolicy where id=$1 and ($2::boolean=false or (effective_at<=clock_timestamp()
      and (retired_at is null or retired_at>clock_timestamp())))`,
      [id, active]
    );
    return freeze(result.rows[0]);
  }
}
function freeze(value: RegistrationPolicyRecord | undefined): RegistrationPolicyRecord | null {
  return value ? Object.freeze(value) : null;
}
