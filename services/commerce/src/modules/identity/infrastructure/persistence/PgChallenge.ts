import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChallengeIssue, ChallengePort, IssuedChallenge, LoginGuardPort } from '../../application/port/ChallengePort';
import { reject } from '../../../../foundation/application/OperationRejection';

import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

const MAXIMUM_ATTEMPTS = RUNTIME_LIMITS.authentication.otp.maximumAttempts;

export class PgChallenge implements ChallengePort {
  private readonly transactions = new PgTransactionAccess();
  async issue(context: WriteTransactionContext, value: ChallengeIssue): Promise<IssuedChallenge> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      purpose: string;
      expires_at: Date;
    }>(
      `with challenge as(
      insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
      values($1,$2,$3,$4,$5,0,clock_timestamp()+make_interval(mins=>$6),clock_timestamp()) returning id,purpose,expires_at),
      secret as(insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,
        destination_key_version,created_at) values($1,$7,$8,$9,$10,clock_timestamp()))
      select id,purpose,expires_at from challenge`,
      [value.id, value.principal, value.purpose, value.destinationHash, value.codeHash, value.ttlMinutes, value.codeCiphertext, value.codeKeyVersion, value.destinationCiphertext, value.destinationKeyVersion]
    );
    const row = result.rows[0];
    if (!row) throw new Error('CHALLENGE_CREATE_FAILED');
    if (value.queueDelivery) await new PgRuntimeWriter(database).schedule({ id: `job:notify:${value.id}`, kind: 'identitynotification', owner: 'identity', scope: value.scope, payload: { challenge: value.id }, priority: 1 });
    return Object.freeze({ id: row.id, purpose: row.purpose, expiresAt: row.expires_at });
  }
  async throttle(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void> {
    const database = this.transactions.database(context);
    for (const [subject, client] of keys) {
      const result = await database.query<{
        failures: number;
      }>(
        `insert into identity.loginattempt
      (subject_hash,client_hash,window_started_at,failures,locked_until) values($1,$2,clock_timestamp(),1,null)
      on conflict(subject_hash,client_hash) do update set failures=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '10 minutes'
      then 1 else identity.loginattempt.failures+1 end,window_started_at=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '10 minutes'
      then clock_timestamp() else identity.loginattempt.window_started_at end returning failures`,
        [subject, client]
      );
      if ((result.rows[0]?.failures ?? 0) > 5) reject('RATE_LIMITED');
    }
  }
  async consume(
    context: WriteTransactionContext,
    challenge: string,
    code: string,
    digest: (id: string, code: string) => string,
    principal?: string,
    expected: Readonly<{
      purpose?: string;
      destinationHash?: string;
    }> = {}
  ): Promise<{
    principal_id: string | null;
  }> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      principal_id: string | null;
    }>(
      `update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<$6
      and ($3::text is null or principal_id=$3) and ($4::text is null or purpose=$4)
      and ($5::text is null or destination_hash=$5) returning principal_id`,
      [challenge, digest(challenge, code), principal ?? null, expected.purpose ?? null, expected.destinationHash ?? null, MAXIMUM_ATTEMPTS]
    );
    if (!result.rows[0]) {
      await failChallenge(database, challenge);
      reject('CHALLENGE_INVALID');
    }
    return result.rows[0]!;
  }
  async verify(
    context: WriteTransactionContext,
    challenge: string,
    code: string,
    digest: (id: string, code: string) => string,
    expected: Readonly<{
      purpose: string;
      destinationHash: string;
    }>
  ): Promise<{
    principal_id: string | null;
  }> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      principal_id: string | null;
    }>(
      `select principal_id from identity.challenge
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<$5
      and purpose=$3 and destination_hash=$4 for update`,
      [challenge, digest(challenge, code), expected.purpose, expected.destinationHash, MAXIMUM_ATTEMPTS]
    );
    if (!result.rows[0]) {
      await failChallenge(database, challenge);
      reject('CHALLENGE_INVALID');
    }
    return result.rows[0]!;
  }
}
export class PgLoginGuard implements LoginGuardPort {
  private readonly transactions = new PgTransactionAccess();
  async assertAllowed(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void> {
    const database = this.transactions.database(context);
    for (const [subject, client] of keys) {
      const result = await database.query<{
        locked: boolean;
      }>(
        `select locked_until>clock_timestamp() locked
      from identity.loginattempt where subject_hash=$1 and client_hash=$2 for update`,
        [subject, client]
      );
      if (result.rows[0]?.locked) reject('RATE_LIMITED');
    }
  }
  async recordFailure(context: WriteTransactionContext, keys: readonly (readonly [string, string])[]): Promise<void> {
    const database = this.transactions.database(context);
    for (const [subject, client] of keys)
      await database.query(
        `insert into identity.loginattempt(subject_hash,client_hash,window_started_at,failures,locked_until)
      values($1,$2,clock_timestamp(),1,null) on conflict(subject_hash,client_hash) do update set
      failures=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else identity.loginattempt.failures+1 end,
      window_started_at=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then clock_timestamp() else identity.loginattempt.window_started_at end,
      locked_until=case when (case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else identity.loginattempt.failures+1 end)>=5
      then clock_timestamp()+interval '15 minutes' else identity.loginattempt.locked_until end`,
        [subject, client]
      );
  }
  async clear(context: WriteTransactionContext, subjectHashes: readonly string[], client: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query("delete from identity.loginattempt where subject_hash=any($1::text[]) and client_hash in($2,'account')", [subjectHashes, client]);
  }
}
async function failChallenge(database: SqlExecutor, challenge: string): Promise<void> {
  await database.query('update identity.challenge set attempts=least($2,attempts+1) where id=$1 and consumed_at is null', [challenge, MAXIMUM_ATTEMPTS]);
}
