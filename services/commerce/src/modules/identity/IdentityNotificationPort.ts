import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface IdentityChallenge {
  readonly purpose: string;
  readonly code_ciphertext: string;
  readonly destination_ciphertext: string;
}

export class IdentityNotificationPort {
  challenge(database: OperationDatabase, id: string) {
    return database.query<IdentityChallenge>(`select challenge.purpose,secret.code_ciphertext,secret.destination_ciphertext
      from identity.challenge challenge join identity.challengesecret secret on secret.challenge_id=challenge.id
      where challenge.id=$1 and challenge.consumed_at is null and challenge.expires_at>clock_timestamp()`, [id]);
  }

  attempt(database: OperationDatabase, id: string, provider: string, state: 'sent' | 'failed', external: string | null, code: string | null) {
    return database.query(`insert into identity.challengedelivery(challenge_id,sequence,provider,external_id,state,error_code,attempted_at)
      select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from identity.challengedelivery where challenge_id=$1`,
    [id, provider, external, state, code]);
  }
}

export const identityNotificationPort = new IdentityNotificationPort();
