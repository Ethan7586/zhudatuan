import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CredentialRepository, CredentialSecurity, CredentialVersion, PasswordCredential } from '../../application/port/CredentialRepository';

interface CredentialRow {
  readonly id: string;
  readonly principal_id: string;
  readonly secret_hash: string | null;
}

export class PgCredentialRepository implements CredentialRepository {
  async matchPassword(database: OperationDatabase, subjectHashes: readonly string[]): Promise<PasswordCredential | null> {
    const result = await database.query<CredentialRow>(
      `select credential.id,credential.principal_id,credential.secret_hash
      from identity.credential credential join identity.principal principal on principal.id=credential.principal_id
      where credential.provider='password' and credential.subject_hash=any($1::text[]) and credential.status='active'
      and principal.status='active' order by array_position($1::text[],credential.subject_hash) for update`,
      [subjectHashes]
    );
    return result.rows.length === 1 ? credentialOf(result.rows[0]!) : null;
  }

  async password(database: OperationDatabase, principal: string, lock: boolean): Promise<PasswordCredential | null> {
    const result = await database.query<CredentialRow>(
      `select id,principal_id,secret_hash from identity.credential
      where principal_id=$1 and provider='password' and status='active' ${lock ? 'for update' : ''}`,
      [principal]
    );
    const row = result.rows[0];
    return row ? credentialOf(row) : null;
  }

  async principalForSubject(database: OperationDatabase, subjectHash: string): Promise<string | null> {
    const result = await database.query<{ principal_id: string }>(
      `select credential.principal_id from identity.credential credential
      join identity.principal principal on principal.id=credential.principal_id and principal.status='active'
      where credential.provider in('password','otp') and credential.subject_hash=$1 and credential.status='active'
      order by credential.principal_id limit 2`,
      [subjectHash]
    );
    return result.rows.length === 1 ? result.rows[0]!.principal_id : null;
  }

  async changePassword(database: OperationDatabase, principal: string, credential: string, secretHash: string, currentSession: string): Promise<CredentialVersion> {
    await database.query('update identity.credential set secret_hash=$2,rotated_at=clock_timestamp() where id=$1', [credential, secretHash]);
    const version = await bump(database, principal);
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='credential_changed'
      where principal_id=$1 and id<>$2 and revoked_at is null`,
      [principal, currentSession]
    );
    return version;
  }

  async resetPassword(database: OperationDatabase, principal: string, secretHash: string): Promise<CredentialVersion> {
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

  async changeSubject(database: OperationDatabase, principal: string, subjectHash: string, currentSession: string): Promise<void> {
    const credential = await this.password(database, principal, true);
    if (!credential) reject('CREDENTIAL_INVALID');
    await database.query('update identity.credential set subject_hash=$2,rotated_at=clock_timestamp() where id=$1', [credential.id, subjectHash]);
    await bump(database, principal);
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason='mobile_changed'
      where principal_id=$1 and id<>$2 and revoked_at is null`,
      [principal, currentSession]
    );
  }

  async security(database: OperationDatabase, principal: string): Promise<CredentialSecurity> {
    const result = await database.query<{ rotated_at: Date | null }>(
      `select rotated_at from identity.credential
      where principal_id=$1 and provider='password' and status='active' order by created_at desc limit 1`,
      [principal]
    );
    return Object.freeze({ hasLocalCredential: result.rows.length > 0, passwordChangedAt: result.rows[0]?.rotated_at ?? null });
  }
}

async function bump(database: OperationDatabase, principal: string): Promise<CredentialVersion> {
  const result = await database.query<{ credentialVersion: number; version: number }>(
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
  return Object.freeze({ id: row.id, principal: row.principal_id, secretHash: row.secret_hash });
}
