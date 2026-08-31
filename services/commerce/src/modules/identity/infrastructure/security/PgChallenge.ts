import type { ChallengeIssue, ChallengePort, IssuedChallenge, LoginGuardPort } from '../../application/port/ChallengePort';
import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export class PgChallenge implements ChallengePort {
  async issue(database: OperationDatabase, value: ChallengeIssue): Promise<IssuedChallenge> {
    const result = await database.query<{ id: string; purpose: string; expires_at: Date }>(
      `with challenge as(
      insert into identity.challenge(id,principal_id,purpose,destination_hash,code_hash,attempts,expires_at,created_at)
      values($1,$2,$3,$4,$5,0,clock_timestamp()+make_interval(mins=>$6),clock_timestamp()) returning id,purpose,expires_at),
      secret as(insert into identity.challengesecret(challenge_id,code_ciphertext,code_key_version,destination_ciphertext,
        destination_key_version,created_at) values($1,$7,$8,$9,$10,clock_timestamp())),
      job as(insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        select $11,'identitynotification','identity',$12,jsonb_build_object('challenge',$1),'queued',1,clock_timestamp(),
          clock_timestamp(),clock_timestamp() where $13::boolean) select id,purpose,expires_at from challenge`,
      [
        value.id,
        value.principal,
        value.purpose,
        value.destinationHash,
        value.codeHash,
        value.ttlMinutes,
        value.codeCiphertext,
        value.codeKeyVersion,
        value.destinationCiphertext,
        value.destinationKeyVersion,
        `job:notify:${value.id}`,
        value.scope,
        value.queueDelivery,
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('CHALLENGE_CREATE_FAILED');
    return Object.freeze({ id: row.id, purpose: row.purpose, expiresAt: row.expires_at });
  }
  async throttle(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
    for (const [subject, client] of keys) {
      const result = await database.query<{ failures: number }>(
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
    database: OperationDatabase,
    challenge: string,
    code: string,
    digest: (id: string, code: string) => string,
    principal?: string,
    expected: Readonly<{ purpose?: string; destinationHash?: string }> = {}
  ): Promise<{ principal_id: string | null }> {
    const result = await database.query<{ principal_id: string | null }>(
      `update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<10
      and ($3::text is null or principal_id=$3) and ($4::text is null or purpose=$4)
      and ($5::text is null or destination_hash=$5) returning principal_id`,
      [challenge, digest(challenge, code), principal ?? null, expected.purpose ?? null, expected.destinationHash ?? null]
    );
    if (!result.rows[0]) {
      await failChallenge(database, challenge);
      reject('CHALLENGE_INVALID');
    }
    return result.rows[0]!;
  }

  async verify(database: OperationDatabase, challenge: string, code: string, digest: (id: string, code: string) => string, expected: Readonly<{ purpose: string; destinationHash: string }>): Promise<{ principal_id: string | null }> {
    const result = await database.query<{ principal_id: string | null }>(
      `select principal_id from identity.challenge
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<10
      and purpose=$3 and destination_hash=$4 for update`,
      [challenge, digest(challenge, code), expected.purpose, expected.destinationHash]
    );
    if (!result.rows[0]) {
      await failChallenge(database, challenge);
      reject('CHALLENGE_INVALID');
    }
    return result.rows[0]!;
  }
}

export class PgLoginGuard implements LoginGuardPort {
  async assertAllowed(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
    for (const [subject, client] of keys) {
      const result = await database.query<{ locked: boolean }>(
        `select locked_until>clock_timestamp() locked
      from identity.loginattempt where subject_hash=$1 and client_hash=$2 for update`,
        [subject, client]
      );
      if (result.rows[0]?.locked) reject('RATE_LIMITED');
    }
  }
  async recordFailure(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
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
  async clear(database: OperationDatabase, subjectHashes: readonly string[], client: string): Promise<void> {
    await database.query("delete from identity.loginattempt where subject_hash=any($1::text[]) and client_hash in($2,'account')", [subjectHashes, client]);
  }
}

async function failChallenge(database: OperationDatabase, challenge: string): Promise<void> {
  await database.query('update identity.challenge set attempts=least(10,attempts+1) where id=$1 and consumed_at is null', [challenge]);
}
