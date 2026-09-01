import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { IdentityChallenge, IdentityChallengeAttempt, NotificationIdentityPort } from '../../public/NotificationIdentityPort';
export class PgNotificationIdentity implements NotificationIdentityPort {
  private readonly transactions = new PgTransactionAccess();
  async recipient(context: ReadTransactionContext, membership: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; subjectCiphertext: string }>('select id,subject_ciphertext "subjectCiphertext" from identity.notification_recipient($1)', [membership]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
  async challenge(context: ReadTransactionContext, id: string) {
    const database = this.transactions.database(context);
    const result = await database.query<IdentityChallenge>(
      `select challenge.purpose,secret.code_ciphertext "codeCiphertext",secret.destination_ciphertext "destinationCiphertext"
      from identity.challenge challenge join identity.challengesecret secret on secret.challenge_id=challenge.id
      where challenge.id=$1 and challenge.consumed_at is null and challenge.expires_at>clock_timestamp()`,
      [id]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
  async beginAttempt(context: WriteTransactionContext, id: string, provider: string) {
    const database = this.transactions.database(context);
    const result = await database.query<IdentityChallengeAttempt>(
      `with uncertain as(
      update identity.challengedelivery set state='ambiguous',error_code=coalesce(error_code,'PREVIOUS_SEND_OUTCOME_UNKNOWN')
      where challenge_id=$1 and state='sending' returning sequence,state,false dispatch
    ), terminal as(
      select sequence,state,false dispatch from uncertain union all
      select sequence,state,false dispatch from identity.challengedelivery
        where challenge_id=$1 and state in('sent','ambiguous')
    ), created as(
      insert into identity.challengedelivery(challenge_id,sequence,provider,state,attempted_at)
      select $1,coalesce((select max(sequence) from identity.challengedelivery where challenge_id=$1),0)+1,$2,'sending',clock_timestamp()
      where not exists(select 1 from terminal) on conflict do nothing returning sequence,state,true dispatch
    ) select sequence,state,dispatch from created union all select sequence,state,dispatch from terminal order by sequence desc limit 1`,
      [id, provider]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
  async completeAttempt(context: WriteTransactionContext, id: string, sequence: number, provider: string, external: string) {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update identity.challengedelivery set state='sent',provider=$3,external_id=$4,error_code=null
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`,
      [id, sequence, provider, external]
    );
    return result.rowCount === 1;
  }
  async failAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.challengedelivery set state='failed',error_code=$3
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`,
      [id, sequence, code]
    );
  }
  async ambiguousAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.challengedelivery set state='ambiguous',error_code=$3
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`,
      [id, sequence, code]
    );
  }
}
