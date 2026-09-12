import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface SmsLoginPrincipal {
  readonly account_id: string;
  readonly realm_id: string;
  readonly principal_id: string;
  readonly credential_version: number;
}

export interface PasswordLoginCredential extends SmsLoginPrincipal {
  readonly secret_hash: string | null;
}

export async function resolveBoundMobileAccount(
  database: OperationDatabase,
  realmId: string,
  mobileTokens: readonly string[],
): Promise<SmsLoginPrincipal | null> {
  const matches = await database.query<SmsLoginPrincipal>(
    `select account.id account_id,account.realm_id,account.legacy_principal_id principal_id,account.credential_version
      from identity.account account
      where identity.realm_contains_account_realm($1,account.realm_id)
        and account.status='active' and account.legacy_principal_id is not null and (
        account.mobile_token=any($2::text[])
        or exists (select 1 from identity.credential credential where credential.account_id=account.id
          and credential.realm_id=account.realm_id and credential.provider='password' and credential.status='active'
          and credential.subject_hash=any($2::text[]))
      )
      order by account.realm_id,account.id for update of account`,
    [realmId, mobileTokens]
  );
  if (new Set(matches.rows.map(({ principal_id }) => principal_id)).size > 1) reject(409, 'IDENTITY_SUBJECT_EXISTS');
  return matches.rows[0] ?? null;
}

export async function resolveMembershipAccount(
  database: OperationDatabase,
  input: Readonly<{
    entryRealmId: string;
    principalId: string;
    membershipClient: string;
    membershipOrganizationId: string;
  }>
): Promise<SmsLoginPrincipal | undefined> {
  const account = await database.query<SmsLoginPrincipal>(
    `select account.id account_id,account.realm_id,account.legacy_principal_id principal_id,
        account.credential_version
      from identity.account account join access.membership membership
        on membership.account_id=account.id and membership.realm_id=account.realm_id
        and membership.client=$3 and membership.organization_id=$4 and membership.status='active'
      where identity.realm_contains_account_realm($1,account.realm_id)
        and account.legacy_principal_id=$2 and account.status='active'
      order by account.realm_id,account.id limit 2 for update of account`,
    [input.entryRealmId, input.principalId, input.membershipClient, input.membershipOrganizationId]
  );
  if (account.rows.length > 1) reject(409, 'IDENTITY_SUBJECT_EXISTS');
  return account.rows[0];
}

export async function resolvePasswordLoginCredential(
  database: OperationDatabase,
  input: Readonly<{
    realmId: string;
    subjectHash: string;
    mobileTokens?: readonly string[];
    membershipClient: string;
    membershipOrganizationId: string;
  }>
): Promise<PasswordLoginCredential | undefined> {
  const credential = await database.query<PasswordLoginCredential>(
    `select account.id account_id,account.realm_id,account.legacy_principal_id principal_id,
        account.credential_version,credential.secret_hash
      from identity.credential credential join identity.account account
        on account.id=credential.account_id and account.realm_id=credential.realm_id
      join access.membership membership on membership.account_id=account.id and membership.realm_id=account.realm_id
        and membership.client=$4 and membership.organization_id=$5 and membership.status='active'
      where identity.realm_contains_account_realm($1,credential.realm_id)
        and credential.provider='password' and credential.status='active' and account.status='active'
        and (($3::text[] is null and credential.subject_hash=$2)
          or ($3::text[] is not null and (credential.subject_hash=any($3::text[])
            or account.mobile_token=any($3::text[]))))
      order by credential.created_at,credential.id limit 2 for update of credential,account`,
    [input.realmId, input.subjectHash, input.mobileTokens ?? null,
      input.membershipClient, input.membershipOrganizationId]
  );
  if (credential.rows.length > 1) reject(409, 'IDENTITY_SUBJECT_EXISTS');
  return credential.rows[0];
}

export async function verifySmsLoginChallenge(
  database: OperationDatabase,
  input: Readonly<{ realmId: string; id: string; codeHash: string; destinationHash: string }>
): Promise<SmsLoginPrincipal | undefined> {
  const verified = await database.query<SmsLoginPrincipal>(
    `select challenge.account_id,challenge.realm_id,account.legacy_principal_id principal_id,account.credential_version
      from identity.challenge challenge join identity.account account
        on account.id=challenge.account_id and account.realm_id=challenge.realm_id
      where challenge.id=$1 and challenge.code_hash=$2 and challenge.consumed_at is null
        and challenge.expires_at>clock_timestamp()
        and identity.realm_contains_account_realm($3,challenge.realm_id)
        and challenge.purpose='login' and challenge.destination_hash=$4 and account.status='active'
      for update of challenge,account`,
    [input.id, input.codeHash, input.realmId, input.destinationHash]
  );
  return verified.rows.length === 1 ? verified.rows[0] : undefined;
}

export async function recordInvalidSmsLoginChallenge(database: OperationDatabase, id: string, destinationHash: string): Promise<void> {
  await database.query(
    `update identity.challenge set attempts=attempts+1
      where id=$1 and purpose='login' and destination_hash=$2 and consumed_at is null`,
    [id, destinationHash]
  );
}

export async function consumeSmsLoginChallenge(
  database: OperationDatabase,
  input: Readonly<{ id: string; codeHash: string; account: string; realmId: string; destinationHash: string }>
): Promise<boolean> {
  const consumed = await database.query(
    `update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
      where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp()
        and account_id=$3 and realm_id=$4 and purpose='login' and destination_hash=$5 returning principal_id`,
    [input.id, input.codeHash, input.account, input.realmId, input.destinationHash]
  );
  return consumed.rowCount === 1;
}
