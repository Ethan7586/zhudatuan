import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { reject } from '../../../../pipeline/OperationRejection';

import type { CredentialRepository, CredentialSecurity, CredentialVersion, PasswordCredential } from '../../application/port/CredentialRepository';
interface CredentialRow {
  readonly id: string;
  readonly principal_id: string;
  readonly secret_hash: string | null;
  readonly credential_version: number;
}
export class PgCredentialRepository implements CredentialRepository {
  private readonly transactions = new PgTransactionAccess();
  async matchPassword(context: ReadTransactionContext, subjectHashes: readonly string[]): Promise<PasswordCredential | null> {
    const database = this.transactions.database(context);
    const result = await database.query<CredentialRow>(
      `select credential.id,credential.principal_id,credential.secret_hash,principal.credential_version
      from identity.credential credential join identity.principal principal on principal.id=credential.principal_id
      where credential.provider='password' and credential.subject_hash=any($1::text[]) and credential.status='active'
      and principal.status='active' order by array_position($1::text[],credential.subject_hash)`,
      [subjectHashes]
    );
    return result.rows.length === 1 ? credentialOf(result.rows[0]!) : null;
  }
  async confirmPassword(context: WriteTransactionContext, credential: Pick<PasswordCredential, 'id' | 'principal' | 'version'>): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select 1 from identity.credential credential join identity.principal principal on principal.id=credential.principal_id
      where credential.id=$1 and credential.principal_id=$2 and credential.provider='password' and credential.status='active'
      and principal.status='active' and principal.credential_version=$3 for update of credential,principal`,
      [credential.id, credential.principal, credential.version]
    );
    return result.rows.length === 1;
  }
  async password(context: WriteTransactionContext, principal: string): Promise<PasswordCredential | null> {
    const database = this.transactions.database(context);
    const result = await database.query<CredentialRow>(
      `select id,principal_id,secret_hash from identity.credential
      where principal_id=$1 and provider='password' and status='active' for update`,
      [principal]
    );
    const row = result.rows[0];
    return row ? credentialOf(row) : null;
  }
  async principalForSubject(context: ReadTransactionContext, subjectHash: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      principal_id: string;
    }>(
      `select credential.principal_id from identity.credential credential
      join identity.principal principal on principal.id=credential.principal_id and principal.status='active'
      where credential.provider in('password','otp') and credential.subject_hash=$1 and credential.status='active'
      order by credential.principal_id limit 2`,
      [subjectHash]
    );
    return result.rows.length === 1 ? result.rows[0]!.principal_id : null;
  }
  async changePassword(context: WriteTransactionContext, principal: string, credential: string, secretHash: string, currentSession: string): Promise<CredentialVersion> {
    const database = this.transactions.database(context);
    await database.query('update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where id=$1', [credential, secretHash]);
    const version = await bump(database, principal);
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_changed'
      where principal_id=$1 and id<>$2 and revoked_at is null`,
      [principal, currentSession]
    );
    return version;
  }
  async resetPassword(context: WriteTransactionContext, principal: string, secretHash: string): Promise<CredentialVersion> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.credential set secret_hash=$2,rotated_at=clock_timestamp()
      where principal_id=$1 and provider='password' and status='active'`,
      [principal, secretHash]
    );
    const version = await bump(database, principal);
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_reset'
      where principal_id=$1 and revoked_at is null`,
      [principal]
    );
    return version;
  }
  async changeSubject(context: WriteTransactionContext, principal: string, subjectHash: string, currentSession: string): Promise<void> {
    const database = this.transactions.database(context);
    const credential = await this.password(context, principal);
    if (!credential) reject('CREDENTIAL_INVALID');
    await database.query('update identity.credential set subject_hash=$2,rotated_at=clock_timestamp() where id=$1', [credential.id, subjectHash]);
    await bump(database, principal);
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='mobile_changed'
      where principal_id=$1 and id<>$2 and revoked_at is null`,
      [principal, currentSession]
    );
  }
  async security(context: ReadTransactionContext, principal: string): Promise<CredentialSecurity> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      rotated_at: Date | null;
    }>(
      `select rotated_at from identity.credential
      where principal_id=$1 and provider='password' and status='active' order by created_at desc limit 1`,
      [principal]
    );
    return Object.freeze({ hasLocalCredential: result.rows.length > 0, passwordChangedAt: result.rows[0]?.rotated_at ?? null });
  }
}
async function bump(database: SqlExecutor, principal: string): Promise<CredentialVersion> {
  const result = await database.query<{
    credentialVersion: number;
    version: number;
  }>(
    `update identity.principal set
    credential_version=credential_version+1,updated_at=clock_timestamp(),version=version+1 where id=$1
    returning credential_version "credentialVersion",version`,
    [principal]
  );
  const row = result.rows[0];
  if (!row) reject('AUTHENTICATION_REQUIRED');
  return Object.freeze({ credentialVersion: Number(row.credentialVersion), version: Number(row.version) });
}
function credentialOf(row: CredentialRow): PasswordCredential {
  return Object.freeze({ id: row.id, principal: row.principal_id, secretHash: row.secret_hash, version: Number(row.credential_version) });
}
