import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface ExistingOperatorAccountInput {
  readonly realm: string;
  readonly principal: string;
  readonly generatedAccount: string;
  readonly generatedCredential: string;
  readonly generatedAssurance: string;
  readonly sourceSecretHash: string | null;
  readonly mobileCiphertext: string;
  readonly mobileFingerprint: string;
  readonly subject: string;
  readonly subjectHash: string;
}

export async function bindExistingOperatorAccount(database: OperationDatabase, input: ExistingOperatorAccountInput):
  Promise<Readonly<{ account: string; realm: string; credentialVersion: number }>> {
  const targetAccount = await database.query<{
    account_id: string; realm_id: string; credential_version: number;
  }>(`select account.id account_id,account.realm_id,account.credential_version
    from identity.account account join identity.credential credential
      on credential.account_id=account.id and credential.realm_id=account.realm_id
      and credential.provider='password' and credential.status='active'
    where account.realm_id=$1 and account.legacy_principal_id=$2 and account.status='active'
    for update of account,credential`, [input.realm, input.principal]);
  if (targetAccount.rows[0]) {
    return { account: targetAccount.rows[0].account_id, realm: targetAccount.rows[0].realm_id,
      credentialVersion: targetAccount.rows[0].credential_version };
  }
  if (input.sourceSecretHash === null) throw new Error('CREDENTIAL_INVALID');
  await database.query(
    `insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version,assurance_level,
      mobile_ciphertext,mobile_token,mobile_masked,phone_verified_at,created_at,updated_at)
    values($1,$2,$3,'active',1,2,$4,$5,$6,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
    [input.generatedAccount, input.realm, input.principal, input.mobileCiphertext, input.mobileFingerprint,
      `${input.subject.slice(0, 3)}****${input.subject.slice(-4)}`]
  );
  await database.query(
    `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
    values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
    [input.generatedCredential, input.principal, input.subjectHash, input.sourceSecretHash, input.realm, input.generatedAccount]
  );
  await database.query(
    `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at,realm_id,account_id)
    values($1,$2,'phone_otp',2,$3,clock_timestamp(),clock_timestamp()+interval '365 days',$4,$5)`,
    [input.generatedAssurance, input.principal, input.subjectHash, input.realm, input.generatedAccount]
  );
  return { account: input.generatedAccount, realm: input.realm, credentialVersion: 1 };
}

export async function currentOperatorMembership(database: OperationDatabase, member: string, organization: string,
  realm: string, account: string): Promise<Readonly<Record<string, unknown>> | undefined> {
  const current = await database.query<Record<string, unknown>>(
    `select * from access.membership where member_id=$1 and organization_id=$2 and client='operator'
      and realm_id=$3 and account_id=$4 and status<>'left'`,
    [member, organization, realm, account]
  );
  return current.rows[0];
}
