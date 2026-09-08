import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ActivationAttempt, ActivationRate } from '../../application/port/ActivationRate';

export class PgActivationRate implements ActivationRate {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async consume(context: WriteTransactionContext, attempt: ActivationAttempt): Promise<boolean> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([attempt.scope, attempt.actor])]);
    const counted = await database.query<{ attempts: number }>(
      `select count(*)::integer attempts from voucher.activationattempt
       where scope_id=$1 and actor_id=$2 and attempted_at>$3::timestamptz-interval '15 minutes'`,
      [attempt.scope, attempt.actor, attempt.attemptedAt]
    );
    if ((counted.rows[0]?.attempts ?? 5) >= 5) return false;
    await database.query(
      `insert into voucher.activationattempt(id,scope_id,actor_id,fingerprint,accepted,attempted_at)
      values($1,$2,$3,$4,false,$5)`,
      [attempt.id, attempt.scope, attempt.actor, attempt.fingerprint, attempt.attemptedAt]
    );
    return true;
  }
}
