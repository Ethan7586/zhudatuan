import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface IdentityChallenge {
  readonly purpose: string;
  readonly code_ciphertext: string;
  readonly destination_ciphertext: string;
}

<<<<<<< HEAD
export interface IdentityChallengeAttempt {
  readonly sequence: number;
  readonly state: 'sending' | 'sent' | 'ambiguous';
  readonly dispatch: boolean;
}

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export class IdentityNotificationPort {
  challenge(database: OperationDatabase, id: string) {
    return database.query<IdentityChallenge>(`select challenge.purpose,secret.code_ciphertext,secret.destination_ciphertext
      from identity.challenge challenge join identity.challengesecret secret on secret.challenge_id=challenge.id
      where challenge.id=$1 and challenge.consumed_at is null and challenge.expires_at>clock_timestamp()`, [id]);
  }

<<<<<<< HEAD
  beginAttempt(database: OperationDatabase, id: string, provider: string) {
    return database.query<IdentityChallengeAttempt>(`with uncertain as(
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
    ) select * from created union all select * from terminal order by sequence desc limit 1`, [id, provider]);
  }

  completeAttempt(database: OperationDatabase, id: string, sequence: number, provider: string, external: string) {
    return database.query(`update identity.challengedelivery set state='sent',provider=$3,external_id=$4,error_code=null
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`,
    [id, sequence, provider, external]);
  }

  failAttempt(database: OperationDatabase, id: string, sequence: number, code: string) {
    return database.query(`update identity.challengedelivery set state='failed',error_code=$3
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`, [id, sequence, code]);
  }

  ambiguousAttempt(database: OperationDatabase, id: string, sequence: number, code: string) {
    return database.query(`update identity.challengedelivery set state='ambiguous',error_code=$3
      where challenge_id=$1 and sequence=$2 and state='sending' returning challenge_id,sequence,state`, [id, sequence, code]);
=======
  attempt(database: OperationDatabase, id: string, provider: string, state: 'sent' | 'failed', external: string | null, code: string | null) {
    return database.query(`insert into identity.challengedelivery(challenge_id,sequence,provider,external_id,state,error_code,attempted_at)
      select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from identity.challengedelivery where challenge_id=$1`,
    [id, provider, external, state, code]);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }
}

export const identityNotificationPort = new IdentityNotificationPort();
