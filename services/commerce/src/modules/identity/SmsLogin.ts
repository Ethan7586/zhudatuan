import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface SmsLoginPrincipal {
  readonly principal_id: string;
  readonly credential_version: number;
}

export async function resolveBoundMobilePrincipal(database: OperationDatabase, mobileTokens: readonly string[]): Promise<string | null> {
  const matches = await database.query<{ principal_id: string }>(
    `select principal.id principal_id from identity.principal principal
      join member.profile profile on profile.principal_id=principal.id and profile.status='active'
      where principal.status='active' and profile.mobile_token=any($1::text[])
      order by principal.id for update of principal,profile`,
    [mobileTokens]
  );
  return matches.rows.length === 1 ? matches.rows[0]!.principal_id : null;
}

export async function verifySmsLoginChallenge(
  database: OperationDatabase,
  input: Readonly<{ id: string; codeHash: string; destinationHash: string }>
): Promise<SmsLoginPrincipal | undefined> {
  const verified = await database.query<SmsLoginPrincipal>(
    `select challenge.principal_id,principal.credential_version
      from identity.challenge challenge join identity.principal principal on principal.id=challenge.principal_id
      where challenge.id=$1 and challenge.code_hash=$2 and challenge.consumed_at is null
        and challenge.expires_at>clock_timestamp() and challenge.attempts<10
        and challenge.purpose='login' and challenge.destination_hash=$3 and principal.status='active'
      for update of challenge,principal`,
    [input.id, input.codeHash, input.destinationHash]
  );
  return verified.rows.length === 1 ? verified.rows[0] : undefined;
}

export async function recordInvalidSmsLoginChallenge(database: OperationDatabase, id: string, destinationHash: string): Promise<void> {
  await database.query(
    `update identity.challenge set attempts=least(10,attempts+1)
      where id=$1 and purpose='login' and destination_hash=$2 and consumed_at is null`,
    [id, destinationHash]
  );
}

export async function consumeSmsLoginChallenge(
  database: OperationDatabase,
  input: Readonly<{ id: string; codeHash: string; principal: string; destinationHash: string }>
): Promise<boolean> {
  const consumed = await database.query(
    `update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<10
        and principal_id=$3 and purpose='login' and destination_hash=$4 returning principal_id`,
    [input.id, input.codeHash, input.principal, input.destinationHash]
  );
  return consumed.rowCount === 1;
}
